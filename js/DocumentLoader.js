/*
Copyright (C) 2016 Apple Inc. All Rights Reserved.
See LICENSE.txt for this sample’s licensing information

Abstract:
This class handles the loading of resources from the network
*/


function DocumentLoader(baseURL) {
    // Bind callback methods to current context
    this.prepareURL = this.prepareURL.bind(this);
    this.prepareElement = this.prepareElement.bind(this);
    this.responses = [];
    // Validate arguments
    if (typeof baseURL !== "string") {
        throw new TypeError("DocumentLoader: baseURL argument must be a string.");
    }
    this.baseURL = baseURL;
}

/*
 * Helper method to request templates from the server
 */
DocumentLoader.prototype.fetchPost = function(options) {
    if (typeof options.url !== "string") {
        throw new TypeError("DocumentLoader.fetch: url option must be a string.");
    }    
    if (typeof options.data == "undefined" || options.data == "") {
	    options.type = "GET";
    } else {
        options.type = "POST";
    }
    // Cancel the previous request if it is still in-flight.
    //if (options.concurrent !== true) {
    //    this.cancelfetchPost();
    //}
    // Parse the request URL
    const docURL = this.prepareURL(options.url);
    const xhr = new XMLHttpRequest();    
    xhr.open(options.type, docURL);
    xhr.responseType = "document";
    xhr.onload = function() {
	    console.log('got status '+xhr.status);
	    if (xhr.status == 202) { //play
		    var msg = JSON.parse(xhr.responseText)		   
		    console.log("got message: " + xhr.responseText);
		    var time;
		    var playCache = localStorage.getItem('playCache');
		    var history = localStorage.getItem('history');
		    if (playCache == null) {
			    playCache = '{}';
		    }
		    if (history == null) {
		        history = '{}';
		    }
		    playCache = JSON.parse(playCache);
		    history = JSON.parse(history);
		    var imdb = msg['imdb'];
		    var season = msg['season'];
		    var episode = msg['episode'];
		    if (imdb != null) {
			    var search = imdb;
			    if (season != null) {
				    search += "S"+season;
			    }
			    if (episode != null) {
				    search += "E"+episode;
			    }
			    if (playCache[search] != null) { //if we've played this item before, retrieve it's stop time
					time = playCache[search];
				} else if (playCache[msg['url']] != null) { //if we've played this url before, retrieve it's stop time
			    	time = playCache[msg['url']];
		    	} else {
			    	time = 0;
		    	}
		    } else {
		    	if (playCache[msg['url']] != null) { //if we've played this url before, retrieve it's stop time
			    	time = playCache[msg['url']];
		    	} else {
			    	time = 0;
		    	}
		    }
		    //VLC player
		    try {
			    if (time != 0) {
				    var formattedTime = this.formatTime(Math.floor(time/1000)); //convert to fomatted time in seconds
				    if (formattedTime == "00:00") {
					    this.play(msg, 0, playCache, options);
				    } else {
				    	var resume = createResumeDocument(formattedTime);
				    	resume.getElementById("resume").addEventListener("select", function() {
						    navigationDocument.removeDocument(resume);
						    this.play(msg, time, playCache, history, options);
						    options.url = msg['continue'];
							this.fetchPost(options);
				    	}.bind(this));
				    	resume.getElementById("begin").addEventListener("select", function() {
						    navigationDocument.removeDocument(resume);
						    this.play(msg, 0, playCache, history, options);
						    options.url = msg['continue'];
							this.fetchPost(options);
				    	}.bind(this));
				    	navigationDocument.pushDocument(resume);
				    }
			    } else {
				    this.play(msg, time, playCache, history, options);
				    options.url = msg['continue'];
					this.fetchPost(options);
			    }			    
		    } catch (e) {
			    console.log(e);
		    } 
					
		} else if(xhr.status == 204) { //do nothing
			//no message
		} else if(xhr.status == 206) { //empty results
		    if (typeof options.abort == "function") {
		    	options.abort();
		    }
		} else if(xhr.status == 208) { //modal results
			var responseDoc = xhr.response;
			responseDoc = this.prepareDocument(responseDoc);
			options.success(responseDoc, true);
		} else if (xhr.status == 210) { //load/save settings
			var msg = JSON.parse(xhr.responseText);
			if (msg['type'] == 'saveSettings') {
				saveSettings(msg['addon'], msg['settings']);
				//options.abort();
			} else if(msg['type'] == 'loadSettings') {
				var settings = loadSettings(msg['addon']);
				this.fetchPost({
					url:'/response/'+msg['msgid'],
					data:btoa(JSON.stringify(settings))
				});
			}
			setTimeout(function() {
				options.url = msg['url']
				this.fetchPost(options);
			}.bind(this), 1000)							
		} else if (xhr.status == 212) { //load url
			var msg = JSON.parse(xhr.responseText);
			var url = msg['url'];
			var data = null;
			if (typeof msg['data'] != "undefined") {
				data = msg['data'];			
			}
			var initial = false;
			if (typeof msg['initial'] != "undefined") {
				initial = msg['initial']
			}
			const temp = navigationDocument.documents[navigationDocument.documents.length - 1]; //loader should be the last page on stack
			if (typeof msg['replace'] == 'boolean' && msg['replace'] && navigationDocument.documents.length > 1) {
				navigationDocument.removeDocument(navigationDocument.documents[navigationDocument.documents.length-2]); //last document should be the loader so remove previous document				
			}
			setTimeout(function() {
				//this.fetchPost(options);
				var match = /\/catalog\/(.*)/.exec(url);
				if (match != null) {
					catalog(match[1], data);
					setTimeout(function() {
						navigationDocument.removeDocument(temp);
					}, 1000);
				} else {
                    new DocumentController(this, url, temp, initial, data);
                }
			}.bind(this), 500);
		} else if (xhr.status == 214) { //new progress
			if (typeof this.progressDocument == "undefined") {
		    	this.progressDocument = xhr.response; //save progress
		    	this.progressDocument.addEventListener("unload", function() { //in case of user cancel, send abort notification
			    	if (typeof this.progressDocument != "undefined") {
			    	    var loadingDocument = createLoadingDocument();
			    	    navigationDocument.pushDocument(loadingDocument);
				    	this.progressDocument = undefined;
				    	if (typeof id != "undefined" && id != "") { //only if response is required
						    this.fetchPost({
		 					    url: "/response/" + id,
		 					    data: "blah"
		 				    });
		 				}
		 			}
		    	}.bind(this));
		    	var progress = this.progressDocument.getElementById("progress")
		    	var url = progress.getAttribute("documentURL");
				var id = progress.getAttribute("msgid");
		    	//display progress document
		    	if (typeof options.success === "function") {
            		options.success(this.progressDocument);
        		} else {
            		navigationDocument.pushDocument(this.progressDocument);
        		}
        	}
        	var progress = this.progressDocument.getElementById("progress")
		    var url = progress.getAttribute("documentURL");
		    var data = progress.getAttribute("data");
        	//fetch new message
			this.fetchPost({
				url: url,
				data: data,
				success: function(doc) { //if we get success, this means we got a regular document without closing the progress
				    if (typeof this.progressDocument != "undefined") { //if progress is still showing, remove it
				        console.log('Manually removing progress document');
                        const temp = this.progressDocument; //save it
				        this.progressDocument = undefined; //delete it so as not to call "unload"
				        navigationDocument.removeDocument(temp);
				    }
				    navigationDocument.pushDocument(doc);
				}.bind(this),
				abort: function() { //if we get abort, remove the progress dialog
					try {
						if (typeof this.progressDocument != "undefined") {
							console.log("Removing progress dialog");
							var save = this.progressDocument;
							this.progressDocument = undefined;
							var loadingDocument = createLoadingDocument();
							navigationDocument.replaceDocument(loadingDocument, save);
							new DocumentController(this, url, loadingDocument, false, data);
						}
					} catch (err) {
					}
				}.bind(this)
			});
		} else if (xhr.status == 216) { //update progress
			if (typeof this.progressDocument != "undefined") {
				var progress = this.progressDocument.getElementById("progress");
				var url = progress.getAttribute("documentURL");
				var id = progress.getAttribute("msgid");
				var data = progress.getAttribute("data");
				//update progress document with updated values
				try {
					console.log("updating progress dialog");
					var updated_progress = xhr.response.getElementById("progress");
					progress.setAttribute('value', updated_progress.getAttribute('value'))
					var updated_text = xhr.response.getElementById("text");
					this.progressDocument.getElementById("text").textContent = updated_text.textContent;
				} catch (err) {
					console.log("Failed to update progress dialog");
				}
			} else {
			    var progress = xhr.response.getElementById('progress');
			    var url = progress.getAttribute("documentURL");
				var id = progress.getAttribute("msgid");
				var data = progress.getAttribute("data");
			}
			    //fetch new message
			    this.fetchPost({
				    url: url,
				    data: data,
				    success: function(doc) { //if we get success, this means we got a regular document with or without closing the progress
				        if (typeof this.progressDocument != "undefined") {
				            console.log('Manually removing progress document');
				            const temp = this.progressDocument; //save it
				            this.progressDocument = undefined; //delete it so as not to call "unload"
				            navigationDocument.replaceDocument(doc, temp);
				        } else { //unload or abort was already called so we need to remove the loading document which is top most document on stack
				            navigationDocument.replaceDocument(doc, navigationDocument.documents[navigationDocument.documents.length-1]);
				        }
				    }.bind(this),
				    abort: function() { //if we get abort, remove the progress dialog
				        console.log('In abort function');
					    try {
						    if (typeof this.progressDocument != "undefined") {
							    console.log("Removing progress dialog");
							    var save = this.progressDocument;
							    this.progressDocument = undefined;
							    var loadingDocument = createLoadingDocument();
							    navigationDocument.replaceDocument(loadingDocument, save);
							    new DocumentController(this, url, loadingDocument, false, data);
						    }
					    } catch (err) {
					    }
				    }.bind(this)
			    });
	    } else if (xhr.status == 218) { //special results		    
		    if (typeof options.special == "function") {
		    	options.special(xhr);
		    }
	    } else { //regular document
        	var responseDoc = xhr.response;        	
			responseDoc = this.prepareDocument(responseDoc);
			if (typeof options.initial == "boolean" && options.initial) {
	        	console.log("registering event handlers");
				responseDoc.addEventListener("disappear", function() {
					if(navigationDocument.documents.length==1) {
						//if we got here than we've exited from the web server since the only page (root) has disappeared
						App.onExit({});
					}
				}.bind(this));	
				setTimeout(function() {
					if (typeof options.success === "function") {
            			options.success(responseDoc);
        			} else {
            			navigationDocument.pushDocument(responseDoc);
        			}
				}, 1000);			
    		} else {
				if (typeof options.success === "function") {
            		options.success(responseDoc);
        		} else {
            		navigationDocument.pushDocument(responseDoc);
        		}
        	}
        }
    }.bind(this);
    xhr.onerror = function() {
        if (typeof options.error === "function") {
            options.error(xhr);
        } else {
            const alertDocument = createLoadErrorAlertDocument(docURL, xhr, true);
            navigationDocument.presentModal(alertDocument);
        }
    };
    xhr.timeout = 60000;
    if (typeof options.data == "undefined" || options.data == "") {
	    xhr.send();
	} else {
		xhr.send(options.data);
	}
    // Preserve the request so it can be cancelled by the next fetch
    if (options.concurrent !== true) {
        this._fetchXHR = xhr;
    }
};

/*
 * Helper method to cancel a running XMLHttpRequest
 */
DocumentLoader.prototype.cancelFetch = function() {
	console.log("Aborting fetch");
    const xhr = this._fetchXHR;
    if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
        xhr.abort();
    }
    delete this._fetchXHR;
};

/*
 * Helper method to convert a relative URL into an absolute URL
 */
DocumentLoader.prototype.prepareURL = function(url) {
    // Handle URLs relative to the "server root" (baseURL)
    if (url == null) {
	    return null;
    }
    if (url.indexOf("/") === 0) {
        url = this.baseURL + url.substr(1);
    }
    return url;
};

/*
 * Helper method to mangle relative URLs in XMLHttpRequest response documents
 */
DocumentLoader.prototype.prepareDocument = function(document) {
	const templates = {};
    var i;
    for (i=0; i<document.documentElement.children.length;i++) {
		if (document.documentElement.children.item(i).tagName.indexOf("Template")!=-1) {			
			templates[document.documentElement.children.item(i).getAttribute("id")] = document.documentElement.children.item(i);
		}
	}
    traverseElements(document.documentElement, this.prepareElement);  
    if (Object.keys(templates).length == 1 && document.getElementsByTagName("searchTemplate").length == 1) {
	    return prepareSearchDocument(document);
    } 
    if (typeof document.getElementById("player")!="undefined") { //player
	    console.log("in new player");
	    var m = document.getElementById("player");
	    var singleVideo = new MediaItem(m.getAttribute('type'), m.getAttribute('url'));
		var videoList = new Playlist();
		videoList.push(singleVideo);
		var myPlayer = m.getFeature('Player');
		console.log("found player "+myPlayer);		
		myPlayer.playlist = videoList;
		//var subtitle = m.getElementsByTagName("text").item(0);
		myPlayer.present();
		var currenttime = 0;
		var duration;
		console.log("media item duration: "+myPlayer.currentMediaItemDuration);
		if (myPlayer.currentMediaItemDuration == null) { //pre tvos 10
			duration = 0;
			myPlayer.addEventListener("shouldHandleStateChange", function(e) {
				duration = e.duration;
			});
		}
		myPlayer.addEventListener("timeDidChange", function(info) {
			currenttime = info.time;				
			//hack for duration
			if (duration == 0) {
				if (myPlayer.currentMediaItemDuration != null && myPlayer.currentMediaItemDuration != 0) {
					duration = myPlayer.currentMediaItemDuration;
				} else {
					myPlayer.pause(); //this will trigger "shouldHandleStateChange"
					setTimeout(function(){
						myPlayer.play();
					},100);
				}
			}
			//subtitle.textContent = "timeDidChange "+info.time;
		}, {"interval":1});			
		myPlayer.addEventListener("stateDidChange", function(e) {  
			if(e.state == "end") {
				options.abort();
				if ((duration - currenttime) * 100/duration <=3) { //if we've stopped at more than 97% play time, don't resume
					currenttime = 0;
				}
				playCache[msg['url']] = currenttime;
				localStorage.setItem('playCache', JSON.stringify(playCache)); //save this url's stop time for future playback
				this.fetchPost({
					url:msg['stop']+"/"+btoa(currenttime.toString()),
					abort: function() {
						//do nothing
					}
				});
			}
		}.bind(this), false); 
    }
    
    if (Object.keys(templates).length > 1) {
	    const type = document.getElementsByTagName("head").item(0).getAttribute("id");
	    if (type == "segmentBar") {
			const items = {};
			const segmentBar = document.createElement("segmentBarHeader");
			segmentBar.setAttribute("autoHighlight", "true");
			segmentBar.appendChild(document.createElement("segmentBar"));
			segmentBar.firstChild.setAttribute("autoHighlight", "true");
			
			for (key in templates) {
				var item = document.createElement("segmentBarItem");
				item.setAttribute("class", key);
				item.appendChild(document.createElement("title"));
				item.firstChild.textContent = templates[key].getAttribute("title");
				segmentBar.firstChild.appendChild(item);
				items[key] = item;
			}
			
			
			segmentBar.firstChild.addEventListener('highlight', function(event) {
        	    selectItem(event.target);
        	}); 
			var selectItem = function(selectedElem) {			
			    const cls = selectedElem.getAttribute("class");
			    for (key in templates) {
				    if (templates[key].parentNode == document.documentElement) {
				    	document.documentElement.removeChild(templates[key]);
				    }
			    }
			    var placeholder = templates[cls].getElementsByTagName("placeholder").item(0);
			    for (item in items) {
				    items[item].removeAttribute("autoHighlight");
			    }
			    items[cls].setAttribute("autoHighlight", "true");
			    placeholder.parentNode.insertBefore(segmentBar, placeholder);
			    document.documentElement.appendChild(templates[cls]);	    
			}
			
			selectItem(segmentBar.firstChild.firstChild);
		} else if (type == "menuBar") {
			const menuBarTemplate = new DOMParser().parseFromString("<document><menuBarTemplate></menuBarTemplate></document>", "application/xml");
			const menuBar = menuBarTemplate.createElement("menuBar");
			const menuBarFeature = menuBar.getFeature("MenuBarDocument");
			//strip document from all templates
			for (key in templates) {
				if (templates[key].parentNode == document.documentElement) {
				    document.documentElement.removeChild(templates[key]);
				}
			}			
			
			for (key in templates) {
				var item = menuBarTemplate.createElement("menuItem");			
				item.appendChild(menuBarTemplate.createElement("title"));
				item.firstChild.textContent = templates[key].getAttribute("title");
				menuBar.appendChild(item);
				var doc = new DOMParser().parseFromString("<document>"+document.documentElement.innerHTML+templates[key].outerHTML+"</document>", "application/xml")
				doc = this.prepareDocument(doc);
				menuBarFeature.setDocument(doc, item);				
			}
			menuBarTemplate.documentElement.firstChild.appendChild(menuBar);												
			return menuBarTemplate;
		}   			                		
    }
    traverseElements(document.documentElement, function(elem) {
	   if (elem.hasAttribute("notify")) {
		   var url = elem.getAttribute("notify");
		   elem.addEventListener("select", function() {
			   this.fetchPost({
					url: url,
					abort: function() {
						navigationDocument.removeDocument(document); //remove the document
					},
					error: function(xhr) {
						//do nothing
					}				
		   		});
	   		}.bind(this)) 
	   	}
	   	if(elem.hasAttribute("abort")) {
		   	var url = elem.getAttribute("abort");
		   	document.addEventListener("unload", function() {
				notify(url);  	
		   	});
	   	}
	   	if(elem.hasAttribute("abortfunction")) {
		   	//var url = function() { return eval(elem.getAttribute("abortfunction"));}.call({document:document});		   	
		   	document.addEventListener("unload", function() {
			   	eval(elem.getAttribute("abortfunction"));
		   	}.bind(this));
	   	}
	   	if(elem.hasAttribute("loadfunction")) {
		   	//var url = function() { return eval(elem.getAttribute("loadfunction"));}.call({document:document});
		   	document.addEventListener("load", function() {
			   	eval(elem.getAttribute("loadfunction"));
		   	}.bind(this));
	   	}
    }.bind(this));
    return document;
};

/*
 * Helper method to mangle relative URLs in DOM elements
 */
DocumentLoader.prototype.prepareElement = function(elem) {
    if (elem.hasAttribute("src")) {
        const rawSrc = elem.getAttribute("src");
        const parsedSrc = this.prepareURL(rawSrc);
        elem.setAttribute("src", parsedSrc);
    }
    if (elem.hasAttribute("srcset")) {
        // TODO Prepare srcset attribute
    }
}

/**
 * Convenience function to iterate and recurse through a DOM tree
 */
function traverseElements(elem, callback) {
    callback(elem);
    const children = elem.children;
    for (var i = 0; i < children.length; ++i) {
	    traverseElements(children.item(i), callback);
    }
}

DocumentLoader.prototype.play = function(msg, time, playCache, history, options) {
	try {
		var player = VLCPlayer.createPlayerWithUrlTimeImageDescriptionTitleImdbSeasonEpisodeCallback(msg['url'], time, this.prepareURL(msg['image']), msg['description'], msg['title'], msg['imdb'], msg['season'], msg['episode'], function(time) {
			try {
				var total = player.getDuration();
				console.log("player ended with "+time+"ms out of "+total+"ms");
				if (total != 0 && (total - time) * 100/total <=3) { //if we've stopped at more than 97% play time, don't resume
					time = 0;
				}
				console.log("calculated time is "+time);
				var imdb = msg['imdb'];
				var season = msg['season'];
				var episode = msg['episode'];
				if (imdb != null) {
				    var search = imdb;
				    if (season != null) {
					    search += "S"+season;
				    }
				    if (episode != null) {
					    search += "E"+episode;
				    }
				    playCache[search] = time;
				} else {
					playCache[msg['url']] = time;
				}
				if (total == 0) {
				    history[msg['history']] = 0; //not started or not played
				} else if (time * 100 / total > 97) {
				    history[msg['history']] = 1; //finished playing
				} else {
				    history[msg['history']] = 2; //middle of playing
				}
				localStorage.setItem('playCache', JSON.stringify(playCache)); //save this url's stop time for future playback
				localStorage.setItem('history', JSON.stringify(history)); //save this url's stop time for future playback
				var url = this.prepareURL(msg['stop']+"/"+btoa(time.toString()));
				console.log("notifying "+url);
				VLCPlayer.notify(url);
			} catch (e) {
				console.log(e);
			}
		}.bind(this));
		console.log("after create player: "+player);
		
		if (typeof(player) == "string") { //an error has occured
			throw player;
		} else if (typeof(player) != "undefined") {
			options.abort(); //remove the loading document
			VLCPlayer.present(player);
		} else {
			//Built-in player
			var singleVideo = new MediaItem(msg['type'], msg['url']);
			if(msg['image'] != null) {
			 singleVideo.artworkImageURL = msg['image'];
			}
			if(msg['description'] != null) {
			 singleVideo.description = msg['description'];
			}
			if(msg['title'] != null) {
			 singleVideo.title = msg['title'];
			}
			//singleVideo.resumeTime = time / 1000; //convert to seconds
			var videoList = new Playlist();
			videoList.push(singleVideo);
			
			 var myPlayer = new Player();
			 console.log("old player");
			 myPlayer.playlist = videoList;
			 myPlayer.play();
			 myPlayer.seekToTime(time);
			
			options.abort(); //remove the loading document
			 		
			var currenttime = 0;
			var duration;
			console.log("media item duration: "+myPlayer.currentMediaItemDuration);
			if (myPlayer.currentMediaItemDuration == null) { //pre tvos 10
			 duration = 0;
			 myPlayer.addEventListener("shouldHandleStateChange", function(e) {
			 	duration = e.duration;
			 });
			}
			myPlayer.addEventListener("timeDidChange", function(info) {
			 currenttime = info.time;				
			 //hack for duration
			 if (duration == 0) {
			 	if (myPlayer.currentMediaItemDuration != null && myPlayer.currentMediaItemDuration != 0) {
			 		duration = myPlayer.currentMediaItemDuration;
			 	} else {
			 		myPlayer.pause(); //this will trigger "shouldHandleStateChange"
			 		setTimeout(function(){
			 			myPlayer.play();
			 		},100);
			 	}
			 }
			}, {"interval":1});			
			myPlayer.addEventListener("stateDidChange", function(e) {  
			 if(e.state == "end") {
			 	if (duration !=0 && (duration - currenttime) * 100/duration <=3) { //if we've stopped at more than 97% play time, don't resume
			 		currenttime = 0;
			 	}
			 	currenttime = currenttime * 1000;
			 	var imdb = msg['imdb'];
				var season = msg['season'];
				var episode = msg['episode'];
				if (imdb != null) {
				    var search = imdb;
				    if (season != null) {
					    search += "S"+season;
				    }
				    if (episode != null) {
					    search += "E"+episode;
				    }
				    playCache[search] = currenttime;
				} else {
					playCache[msg['url']] = currenttime;
				}
				if (duration == 0) {
				    history[msg['history']] = 0; //not started or not played
				} else if (currenttime * 100 / duration > 97) {
				    history[msg['history']] = 1; //finished playing
				} else {
				    history[msg['history']] = 2; //middle of playing
				}
				localStorage.setItem('playCache', JSON.stringify(playCache)); //save this url's stop time for future playback
				localStorage.setItem('history', JSON.stringify(history)); //save this url's stop time for future playback
				var url = this.prepareURL(msg['stop']+"/"+btoa(currenttime.toString()));
				notify(url);
			 }
			}.bind(this), false);
		}
	} catch (e) {
		console.log(e);
		options.abort(); //remove the loading document
		var alert = createAlertDocument("Error", "Error playing URL "+msg['url'], true);
		navigationDocument.presentModal(alert);
		var url = this.prepareURL(msg['stop']+"/"+btoa(time.toString()));
		notify(url);
	}	
	
}

DocumentLoader.prototype.formatTime = function(time) {
	if (time < 60) { //less than a minute
		var seconds = Number(time).toFixed(0);
		return "00:"+("0" + seconds).slice(-2);
	}
	if (time < 3600) { //less than an hour
		var minutes = Math.floor(time / 60);
		var seconds = time%60;
		return ("0" + minutes).slice(-2)+":"+("0" + seconds).slice(-2);
	}
	var hours = Math.floor(time / 3600);
	return ("0" + hours).slice(-2)+":"+formatTime(time%3600);
}

