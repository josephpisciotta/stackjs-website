/**
*
*	StackJS Framework Version 0.4
*	Author: Elad Yarkoni
*
*	CHANGELOG
*
*	Version 0.4
*	-------------
*   - add: didHashChanged for url hash change events
*	- add: default object setInterval and setTimeout methods implementation with object context
*	- add: removeEvent method on view objects
*	- add: link html elements to view members through outlet attribute
*	- add: getView method to get single html element
*	- fix: getViews now gets all matched elements
*	- fix: Viewport element setter on load event (window.attachEvent browsers)	
*
*	Version 0.3
*	-------------
*	- add: local classses support (use LocalClass instead of Class)
*	- fix: handle undefined parameters in addViews method
*	- fix: handle undefined body element
*
*	Version 0.2
*	-------------
*	- add: nodejs integration!
*	- change: View: addEvent method signature. use addEvent(string selector, string eventType, string eventName, boolean preventDefault);
*	- fix: print stack trace only if there is no 'Catch' for the exception
*
*	Version 0.1.2
*	-------------
*	- fix: add event to root element when addEvent selector returns nothing
*	- add: DeprecatedException exception is added. use Throw(new DeprecatedException(<old method>, <new method>));
*	- add: new view property: elementType. (default is "div")
*	- add: new view property: elementClass. (default is "view")
*	- add: Viewport new methods: getWidth() and getHeight()
*	- change: didBecomeActive method gets the Viewport view object as parameter
*
*	Version 0.1.1
*	-------------
*	- fix: add event for multiple elements
*	- fix: loosing element context while adding multiple view with addViews method
*	- fix: viewport didBecomeActive event
*
*/
(function(){
	/**
	*	STACKJS Defaults
	**/
	var Defaults = {
		defaultObjectName: "STObject",
		extendsSeperator: "::",
		stackSize: 100,
		viewPlaceholder: '$$',
		enableCollector: true
	};
	
	/**
	*
	*	STACKJS Classes holder
	*
	**/
	var _classes = {};

	/**
	*
	*	STACKJS shared objects holder
	*
	**/
	var _sharedObjects = {};

	/**
	*
	*	STACKJS exception callbacks holder
	*
	**/
	var _exceptionCallbacks = {};

	/**
	*
	*	STACKJS Privates
	*
	**/
	var _globalsObject = (typeof(window) !== 'undefined') ? window : global;

	var report = function(text) {
		var date = new Date();
		console.log("STACKJS: " + date.toString() + " : " + text);
	};

	var parseClassName = function(classStr) {
		var classNameArray = classStr.split(Defaults.extendsSeperator);
		var className = classNameArray[0];
		var extend = classNameArray[1];
		return {
			name: className,
			extend: extend
		};
	};

	var getterMethodBuilder = function (name, originalProperty){
		return function(){
			Stack.push(name, this, originalProperty);
			var retValue = this[originalProperty];
			Stack.pop();
			return retValue;
		};
	};

	var setterMethodBuilder = function(name, originalProperty){
		return function(object){
			Stack.push(name, this, originalProperty);
			this[originalProperty] = object;
			Stack.pop();
		};
	};

	var classMethodBuilder = function(name, originalProperty){
		var myFunction = this[originalProperty];
		return function(object){
			Stack.push(name, this, originalProperty);
			var retValue = myFunction.apply(this,arguments);
			Stack.pop();
			return retValue;
		};
	};

	var getGetterSetterName = function(action, propertyName) {
		return action + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
	};

	/**
	*
	*	STACKJS Stack Object
	*
	**/
	var Stack = {

		stack: [],

		/**
		* push data to stack
		*/
		push: function(className, objectRef, methodName) {
			if (Defaults.stackSize == this.stack.length) {
				this.stack.shift();
			}
			this.stack.push({
				className: className,
				methodName: methodName
			});
		},
		/**
		* pop data from stack
		*/
		pop: function() {
			return this.stack.pop();
		},
		/**
		* clear stack
		*/
		clear: function() {
			this.stack = [];
		},
		/**
		* print stack trace
		*/
		printStackTrace: function(exceptionObject) {
			var traceStr = "";
			for (var i = 0; i < this.stack.length; i++) {
				var stackObect = this.stack[i];
				traceStr += stackObect.className + " : " + stackObect.methodName + " -> ";
			}
			traceStr += exceptionObject.toString();
			report(traceStr);
		}
	};

	/**
	* Throw Method
	*
	*/
	var Throw = function(exceptionObject) {
		if (typeof(_exceptionCallbacks[exceptionObject._class]) !== 'undefined') {
			_exceptionCallbacks[exceptionObject._class](exceptionObject);
		} else {
			Stack.printStackTrace(exceptionObject);
			Stack.clear();
		}
	};

	/**
	* Catch Method
	*
	*/
	var Catch = function(exceptionName, callback) {
		_exceptionCallbacks[exceptionName] = callback;
	};

	/**
	*
	*	STACKJS Publics
	*
	**/
	var ClassBuilder = function(name,data,isLocalClass) {
		var classNameObject = parseClassName(name);
		name = classNameObject.name;
		var extendsClassName = classNameObject.extend;

		if (typeof(extendsClassName) === 'undefined') {
			extendsClassName = Defaults.defaultObjectName;
		}

		//
		// get all extended classes
		//
		var extendedClasses = [];
		var extendsTemp = extendsClassName;
		while (extendsTemp !== Defaults.defaultObjectName) {
			extendedClasses.push(extendsTemp);
			extendsTemp = _classes[extendsTemp].prototype._extends;
		}
		extendedClasses.reverse();

		//
		// Add annotations
		//
		var classPropertiesAnnotations = {};
		for (var property in data) {
			// handle annotations
			if (property.charAt(0) === '@') {
				var matches = property.match(/(\w+)\s*\(\s*(\w+)\s*\)/);
				var propName = matches[2];
				var annotationName = matches[1];
				var annotation = {
					annotation: annotationName,
					value: data[property]
				};
				classPropertiesAnnotations[propName] = annotation;
			}
		}

		//
		// class empty function function
		//
		_classes[name] = function() {
			// identify creation of new object
			if (this.constructor !== _classes[name]) {
				if (typeof(_sharedObjects[name]) === 'undefined') {
					_sharedObjects[name] = new _classes[name]();
				}
				return _sharedObjects[name];
			}
			if (typeof(extendedClasses) !== 'undefined') {
				for (var i = 0; i < extendedClasses.length; i++) {
					if (typeof(this[extendedClasses[i]]) !== 'undefined') {
						this[extendedClasses[i]].apply(this,arguments);
					}
				}
			}
			// active class constructors
			if (typeof(this[name]) !== 'undefined') {
				this[name].apply(this,arguments);
			}
		};

		//
		// Copy Extended class to new class
		//
		for (var proto in _classes[extendsClassName].prototype) {
			if ((proto.charAt(0) !== "_") && (proto.charAt(0) !== "@")) {
				_classes[name].prototype[proto] = _classes[extendsClassName].prototype[proto];
			}
		}

		//
		// Modify Class Methods
		//
		var propertyName;
		for (propertyName in data) {
			if ((typeof(data[propertyName]) !== 'function')) {
				var getterName = getGetterSetterName("get",propertyName);
				var setterName = getGetterSetterName("set",propertyName);
				if ((typeof(data[getterName]) !== 'function') && (propertyName.charAt(0) !== '_') && (propertyName.charAt(0) !== '@')) {
					data[getterName] = getterMethodBuilder.apply(data,[name, propertyName]);
				}
				if ((typeof(data[setterName]) !== 'function') && (propertyName.charAt(0) !== '_') && (propertyName.charAt(0) !== '@')) {
					data[setterName] = setterMethodBuilder.apply(data,[name, propertyName]);
				}
			} else {
				data[propertyName] = classMethodBuilder.apply(data,[name, propertyName]);
			}
		}

		// convert data object to class
		for (propertyName in data) {
			_classes[name].prototype[propertyName] = data[propertyName];
		}

		// adding more data instance
		_classes[name].prototype["_extends"] = extendsClassName;
		_classes[name].prototype["_extendsList"] = extendedClasses;
		_classes[name].prototype["_class"] = name;
		_classes[name].prototype["_annotations"] = classPropertiesAnnotations;

		// export to global
		if (isLocalClass) {
			return _classes[name];
		} else {
			_globalsObject[name] = _classes[name];
		}
	};

	/*
	* LocalClass definition
	*
	*/
	var LocalClass = function(name, data) {
		return ClassBuilder(name, data, true);
	};

	/*
	* GlobalClass definition
	*
	*/
	var Class = function(name, data) {
		return ClassBuilder(name, data, false);
	};

	/********************************************************
	*
	* StackJS Default Object
	*
	*********************************************************/
	Class(Defaults.defaultObjectName, {

		delegate: null,

		isExtends: function(classStr) {
			for (var i = 0; i < this._extendsList.length; i++) {
				if (this._extendsList[i] === classStr) {
					return true;
				}
			}
			return false;
		},

		callDelegate: function(methodName,params) {
			if ((this.delegate !== null) && (typeof(this.delegate[methodName]) !== 'undefined')) {
				this.delegate[methodName].apply(this.delegate, params);
			}
		},

		clone: function() {
			return Object.create(this);
		},

		setTimeout: function(callback, milliseconds) {
			var self = this;
			setTimeout(function(){
				callback.apply(self);
			},milliseconds);
		},

		setInterval: function(callback, milliseconds) {
			var self = this;
			var interval = setInterval(function(){
				callback.apply(self);
			},milliseconds);
			return interval;
		}

	});

	/********************************************************
	*
	* StackJS Exception Types
	*
	*********************************************************/
	Class('Exception',{
		message: null,
		Exception: function(message) {
			this.message = message;
		},
		toString: function() {
			return this._class + ": " + this.message + " ";
		}
	});

	Class('MissingAnnotationException::Exception', {
		MissingAnnotationException: function(annotationName) {
			this.message = annotationName + " annotation is missing";
		}
	});

	Class('InvalidParameterException::Exception', {
		InvalidParameterException: function(expectedType, parameterIndex) {
			this.message = "parameter " + parameterIndex + " should be " + expectedType;
		}
	});

	Class('UnsupportedOperationException::Exception', {
		UnsupportedOperationException: function(methodName) {
			this.message = methodName + " method is not implemented yet";
		}
	});

	Class('DeprecatedException::Exception', {
		DeprecatedException: function(oldMethod, newMethod) {
			this.message = "Method " + oldMethod + " is deprecated, please use " + newMethod + " instead";
		}
	});


	/********************************************************
	*
	* StackJS Client Framework
	*
	*********************************************************/
	Class('View', {

		element: null,
		controller: null,
		model: null,
		elementType: "div",
		elementClass: 'view',

		View: function() {
			this.element = document.createElement(this.elementType);
			this.element.className = this.elementClass;
		},

		addClasses: function() {
			this.element.className = "";
			for (var i = 0; i < arguments.length; i++) {
				this.element.className += arguments[i] + " ";
			}
		},

		getViews: function(selector) {
			return this.element.querySelectorAll(selector);
		},

		getView: function(selector) {
			return this.element.querySelector(selector);
		},

		addViews: function(template) {
			var ph = Defaults.viewPlaceholder;
			for (var k = 1; k < arguments.length; k++) {
				if ((arguments[k] !== null) && (typeof(arguments[k] !== 'undefined'))) {
					if ((typeof(arguments[k]) === 'string') || (typeof(arguments[k]) === 'boolean') || (typeof(arguments[k]) === 'number')) {
						template = template.replace(ph, arguments[k]);
					} else if ((arguments[k].isExtends('View')) || (arguments[k]._class === "View")) {
						template = template.replace(ph, "<div class='view-placeholder'></div>");
					}
				}
			}
			var elementHandler = document.createElement('div');
			elementHandler.innerHTML = template;
			for (var i = 1; i < arguments.length; i++) {
				if ((arguments[i] !== null) && (typeof(arguments[i]) !== 'undefined')) {
					if ((arguments[i].isExtends) && ((arguments[i].isExtends('View')) || (arguments[i]._class === "View"))) {
						var view = arguments[i];
						if ((typeof(this.delegate) !== 'undefined') && (view.delegate === null) && (this.delegate !== null) && (this._class !== 'Viewport')) {
							view.setDelegate(this.delegate);
						}
						if ((typeof(this.model) !== 'undefined') && (view.model === null) && (this.model !== null) && (this._class !== 'Viewport')) {
							view.setModel(this.model);
						}
						view.render();
						var replacableNode = elementHandler.querySelector(".view-placeholder");
						var replacableParentNode = replacableNode.parentNode;
						replacableParentNode.appendChild(view.element);
						replacableParentNode.removeChild(replacableNode);
					}
				}
			}
			if ( elementHandler.hasChildNodes()) {
				while ( elementHandler.childNodes.length >= 1 ) {
					this.element.appendChild(elementHandler.firstChild);
				}
			}
			// connect outlets
			var outletElements = this.getViews("[outlet]");
			if (outletElements.length) {
				for (var c = 0; c < outletElements.length; c++) {
					var classMemberName = outletElements[c].getAttribute('outlet');
					if (typeof(classMemberName) !== 'undefined') {
						this[classMemberName] = outletElements[c];
					}
				}
			}
		},

		clearViews: function() {
			var cell = this.element;
			if ( cell.hasChildNodes()) {
				while ( cell.childNodes.length >= 1 ) {
					if (cell.firstChild.nodeType !== 3) {
						var outletRef = cell.firstChild.getAttribute('outlet');
						if ((typeof(outletRef) !== 'undefined') && (outletRef !== null)) {
							delete this[outletRef];
						}	
					}
					cell.removeChild(cell.firstChild);
				}
			}
		},

		removeView: function() {
			this.element.parentNode.removeChild(this.element);
		},
		
		addEvent: function(selector, eventType, eventName, preventDefault) {
			var _self = this;
			preventDefault = (typeof(preventDefault) === "undefined") ? false : preventDefault;
			var eventCallback = (function() {
				return function(evt) {
					if (preventDefault) { evt.preventDefault(); }
					_self.handleEvents.apply(_self,[evt,eventName]);
				};
			}).apply(_self);
			var elements = this.element.querySelectorAll(selector);
			if (elements.length === 0) {
				elements = [this.element];
			}
			for (var i = 0; i < elements.length; i++) {
				elements[i][eventType] = eventCallback;
			}
		},

		removeEvent: function(selector, eventType) {
			var elements = this.element.querySelectorAll(selector);
			if (elements.length === 0) {
				elements = [this.element];
			}
			for (var i = 0; i < elements.length; i++) {
				elements[i][eventType] = null;
			}
		},

		handleEvents: function(eventObject, eventName) {
			Throw(new UnsupportedOperationException('handleEvents'));
		},
		render: function() {
			return this.element;
		}
	});

	Class('Viewport::View', {

		width: (typeof(window) !== 'undefined') ? window.innerWidth : 0,
		height: (typeof(window) !== 'undefined') ? window.innerHeight: 0,

		init: function(delegate) {
			this.delegate = delegate;
			this.start();
		},

		start: function() {
			var _self = this;
			if (document.addEventListener) {
				window.addEventListener( "load", function(){
					_self.element = document.body;
					window.location.hash = "";
					_self.callDelegate('didBecomeActive', [_self]);
				}, false );
				window.addEventListener( "beforeunload", function(){
					_self.callDelegate('willResignActive', [_self]);
				}, false );
				window.addEventListener( "unload", function(){
					_self.callDelegate('willTerminate', [_self]);
				}, false );
				window.addEventListener( "hashchange", function(){
					_self.callDelegate('didHashChanged', [_self]);
				}, false );
			} else {
				window.attachEvent( "onload", function() {
					_self.element = document.body;
					window.location.hash = "";
					_self.callDelegate('didBecomeActive', [_self]);
				});
				window.attachEvent( "onbeforeunload", function() {
					_self.callDelegate('willResignActive', [_self]);
				});
				window.attachEvent( "onunload", function() {
					_self.callDelegate('willTerminate', [_self]);
				});
				window.attachEvent( "onhashchange", function(){
					_self.callDelegate('didHashChanged', [_self]);
				});
			}
		}
	});

	/*
	*	Global Variables
	*/
	_globalsObject.Class = Class;
	_globalsObject.LocalClass = LocalClass;
	_globalsObject.Throw = Throw;
	_globalsObject.Catch = Catch;
})();
