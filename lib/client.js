window.__ModuleLoader__.load({
	id: "whale-girl",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// node_modules/xstate/dist/xstate-dev.esm.js
function getGlobal() {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
}
function getDevTools() {
  const w = getGlobal();
  if (w.__xstate__) {
    return w.__xstate__;
  }
  return void 0;
}
var devToolsAdapter = (service) => {
  if (typeof window === "undefined") {
    return;
  }
  const devTools = getDevTools();
  if (devTools) {
    devTools.register(service);
  }
};

// node_modules/xstate/dist/raise-effbee0c.esm.js
var Mailbox = class {
  constructor(_process) {
    this._process = _process;
    this._active = false;
    this._current = null;
    this._last = null;
  }
  start() {
    this._active = true;
    this.flush();
  }
  clear() {
    if (this._current) {
      this._current.next = null;
      this._last = this._current;
    }
  }
  enqueue(event) {
    const enqueued = {
      value: event,
      next: null
    };
    if (this._current) {
      this._last.next = enqueued;
      this._last = enqueued;
      return;
    }
    this._current = enqueued;
    this._last = enqueued;
    if (this._active) {
      this.flush();
    }
  }
  flush() {
    while (this._current) {
      const consumed = this._current;
      this._process(consumed.value);
      this._current = consumed.next;
    }
    this._last = null;
  }
};
var STATE_DELIMITER = ".";
var TARGETLESS_KEY = "";
var NULL_EVENT = "";
var STATE_IDENTIFIER = "#";
var WILDCARD = "*";
var XSTATE_INIT = "xstate.init";
var XSTATE_ERROR = "xstate.error";
var XSTATE_STOP = "xstate.stop";
function createAfterEvent(delayRef, id) {
  return {
    type: `xstate.after.${delayRef}.${id}`
  };
}
function createDoneStateEvent(id, output) {
  return {
    type: `xstate.done.state.${id}`,
    output
  };
}
function createDoneActorEvent(invokeId, output) {
  return {
    type: `xstate.done.actor.${invokeId}`,
    output,
    actorId: invokeId
  };
}
function createErrorActorEvent(id, error) {
  return {
    type: `xstate.error.actor.${id}`,
    error,
    actorId: id
  };
}
function createInitEvent(input) {
  return {
    type: XSTATE_INIT,
    input
  };
}
function reportUnhandledError(err) {
  setTimeout(() => {
    throw err;
  });
}
var symbolObservable = (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
function matchesState(parentStateId, childStateId) {
  const parentStateValue = toStateValue(parentStateId);
  const childStateValue = toStateValue(childStateId);
  if (typeof childStateValue === "string") {
    if (typeof parentStateValue === "string") {
      return childStateValue === parentStateValue;
    }
    return false;
  }
  if (typeof parentStateValue === "string") {
    return parentStateValue in childStateValue;
  }
  return Object.keys(parentStateValue).every((key) => {
    if (!(key in childStateValue)) {
      return false;
    }
    return matchesState(parentStateValue[key], childStateValue[key]);
  });
}
function toStatePath(stateId) {
  if (isArray(stateId)) {
    return stateId;
  }
  const result = [];
  let segment = "";
  for (let i = 0; i < stateId.length; i++) {
    const char = stateId.charCodeAt(i);
    switch (char) {
      // \
      case 92:
        segment += stateId[i + 1];
        i++;
        continue;
      // .
      case 46:
        result.push(segment);
        segment = "";
        continue;
    }
    segment += stateId[i];
  }
  result.push(segment);
  return result;
}
function toStateValue(stateValue) {
  if (isMachineSnapshot(stateValue)) {
    return stateValue.value;
  }
  if (typeof stateValue !== "string") {
    return stateValue;
  }
  const statePath = toStatePath(stateValue);
  return pathToStateValue(statePath);
}
function pathToStateValue(statePath) {
  if (statePath.length === 1) {
    return statePath[0];
  }
  const value = {};
  let marker = value;
  for (let i = 0; i < statePath.length - 1; i++) {
    if (i === statePath.length - 2) {
      marker[statePath[i]] = statePath[i + 1];
    } else {
      const previous = marker;
      marker = {};
      previous[statePath[i]] = marker;
    }
  }
  return value;
}
function mapValues(collection, iteratee) {
  const result = {};
  const collectionKeys = Object.keys(collection);
  for (let i = 0; i < collectionKeys.length; i++) {
    const key = collectionKeys[i];
    result[key] = iteratee(collection[key], key, collection, i);
  }
  return result;
}
function toArrayStrict(value) {
  if (isArray(value)) {
    return value;
  }
  return [value];
}
function toArray(value) {
  if (value === void 0) {
    return [];
  }
  return toArrayStrict(value);
}
function resolveOutput(mapper, context, event, self2) {
  if (typeof mapper === "function") {
    return mapper({
      context,
      event,
      self: self2
    });
  }
  return mapper;
}
function isArray(value) {
  return Array.isArray(value);
}
function isErrorActorEvent(event) {
  return event.type.startsWith("xstate.error.actor");
}
function toTransitionConfigArray(configLike) {
  return toArrayStrict(configLike).map((transitionLike) => {
    if (typeof transitionLike === "undefined" || typeof transitionLike === "string") {
      return {
        target: transitionLike
      };
    }
    return transitionLike;
  });
}
function normalizeTarget(target) {
  if (target === void 0 || target === TARGETLESS_KEY) {
    return void 0;
  }
  return toArray(target);
}
function toObserver(nextHandler, errorHandler, completionHandler) {
  const isObserver = typeof nextHandler === "object";
  const self2 = isObserver ? nextHandler : void 0;
  return {
    next: (isObserver ? nextHandler.next : nextHandler)?.bind(self2),
    error: (isObserver ? nextHandler.error : errorHandler)?.bind(self2),
    complete: (isObserver ? nextHandler.complete : completionHandler)?.bind(self2)
  };
}
function createInvokeId(stateNodeId, index) {
  return `${index}.${stateNodeId}`;
}
function resolveReferencedActor(machine, src) {
  const match = src.match(/^xstate\.invoke\.(\d+)\.(.*)/);
  if (!match) {
    return machine.implementations.actors[src];
  }
  const [, indexStr, nodeId] = match;
  const node = machine.getStateNodeById(nodeId);
  const invokeConfig = node.config.invoke;
  return (Array.isArray(invokeConfig) ? invokeConfig[indexStr] : invokeConfig).src;
}
function matchesEventDescriptor(eventType, descriptor) {
  if (descriptor === eventType) {
    return true;
  }
  if (descriptor === WILDCARD) {
    return true;
  }
  if (!descriptor.endsWith(".*")) {
    return false;
  }
  const partialEventTokens = descriptor.split(".");
  const eventTokens = eventType.split(".");
  for (let tokenIndex = 0; tokenIndex < partialEventTokens.length; tokenIndex++) {
    const partialEventToken = partialEventTokens[tokenIndex];
    const eventToken = eventTokens[tokenIndex];
    if (partialEventToken === "*") {
      const isLastToken = tokenIndex === partialEventTokens.length - 1;
      return isLastToken;
    }
    if (partialEventToken !== eventToken) {
      return false;
    }
  }
  return true;
}
function createScheduledEventId(actorRef, id) {
  return `${actorRef.sessionId}.${id}`;
}
var idCounter = 0;
function createSystem(rootActor, options) {
  const children = /* @__PURE__ */ new Map();
  const keyedActors = /* @__PURE__ */ new Map();
  const reverseKeyedActors = /* @__PURE__ */ new WeakMap();
  const inspectionObservers = /* @__PURE__ */ new Set();
  const timerMap = {};
  const {
    clock,
    logger
  } = options;
  const scheduler = {
    schedule: (source, target, event, delay, id = Math.random().toString(36).slice(2)) => {
      const scheduledEvent = {
        source,
        target,
        event,
        delay,
        id,
        startedAt: Date.now()
      };
      const scheduledEventId = createScheduledEventId(source, id);
      system._snapshot._scheduledEvents[scheduledEventId] = scheduledEvent;
      const timeout = clock.setTimeout(() => {
        delete timerMap[scheduledEventId];
        delete system._snapshot._scheduledEvents[scheduledEventId];
        system._relay(source, target, event);
      }, delay);
      timerMap[scheduledEventId] = timeout;
    },
    cancel: (source, id) => {
      const scheduledEventId = createScheduledEventId(source, id);
      const timeout = timerMap[scheduledEventId];
      delete timerMap[scheduledEventId];
      delete system._snapshot._scheduledEvents[scheduledEventId];
      if (timeout !== void 0) {
        clock.clearTimeout(timeout);
      }
    },
    cancelAll: (actorRef) => {
      for (const scheduledEventId in system._snapshot._scheduledEvents) {
        const scheduledEvent = system._snapshot._scheduledEvents[scheduledEventId];
        if (scheduledEvent.source === actorRef) {
          scheduler.cancel(actorRef, scheduledEvent.id);
        }
      }
    }
  };
  const sendInspectionEvent = (event) => {
    if (!inspectionObservers.size) {
      return;
    }
    const resolvedInspectionEvent = {
      ...event,
      rootId: rootActor.sessionId
    };
    inspectionObservers.forEach((observer) => observer.next?.(resolvedInspectionEvent));
  };
  const system = {
    _snapshot: {
      _scheduledEvents: (options?.snapshot && options.snapshot.scheduler) ?? {}
    },
    _bookId: () => `x:${idCounter++}`,
    _register: (sessionId, actorRef) => {
      children.set(sessionId, actorRef);
      return sessionId;
    },
    _unregister: (actorRef) => {
      children.delete(actorRef.sessionId);
      const systemId = reverseKeyedActors.get(actorRef);
      if (systemId !== void 0) {
        keyedActors.delete(systemId);
        reverseKeyedActors.delete(actorRef);
      }
    },
    get: (systemId) => {
      return keyedActors.get(systemId);
    },
    getAll: () => {
      return Object.fromEntries(keyedActors.entries());
    },
    _set: (systemId, actorRef) => {
      const existing = keyedActors.get(systemId);
      if (existing && existing !== actorRef) {
        throw new Error(`Actor with system ID '${systemId}' already exists.`);
      }
      keyedActors.set(systemId, actorRef);
      reverseKeyedActors.set(actorRef, systemId);
    },
    inspect: (observerOrFn) => {
      const observer = toObserver(observerOrFn);
      inspectionObservers.add(observer);
      return {
        unsubscribe() {
          inspectionObservers.delete(observer);
        }
      };
    },
    _sendInspectionEvent: sendInspectionEvent,
    _relay: (source, target, event) => {
      system._sendInspectionEvent({
        type: "@xstate.event",
        sourceRef: source,
        actorRef: target,
        event
      });
      target._send(event);
    },
    scheduler,
    getSnapshot: () => {
      return {
        _scheduledEvents: {
          ...system._snapshot._scheduledEvents
        }
      };
    },
    start: () => {
      const scheduledEvents = system._snapshot._scheduledEvents;
      system._snapshot._scheduledEvents = {};
      for (const scheduledId in scheduledEvents) {
        const {
          source,
          target,
          event,
          delay,
          id
        } = scheduledEvents[scheduledId];
        scheduler.schedule(source, target, event, delay, id);
      }
    },
    _clock: clock,
    _logger: logger
  };
  return system;
}
var executingCustomAction = false;
var $$ACTOR_TYPE = 1;
var ProcessingStatus = /* @__PURE__ */ (function(ProcessingStatus2) {
  ProcessingStatus2[ProcessingStatus2["NotStarted"] = 0] = "NotStarted";
  ProcessingStatus2[ProcessingStatus2["Running"] = 1] = "Running";
  ProcessingStatus2[ProcessingStatus2["Stopped"] = 2] = "Stopped";
  return ProcessingStatus2;
})({});
var defaultOptions = {
  clock: {
    setTimeout: (fn, ms) => {
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => {
      return clearTimeout(id);
    }
  },
  logger: console.log.bind(console),
  devTools: false
};
var Actor = class {
  /**
   * Creates a new actor instance for the given logic with the provided options,
   * if any.
   *
   * @param logic The logic to create an actor from
   * @param options Actor options
   */
  constructor(logic, options) {
    this.logic = logic;
    this._snapshot = void 0;
    this.clock = void 0;
    this.options = void 0;
    this.id = void 0;
    this.mailbox = new Mailbox(this._process.bind(this));
    this.observers = /* @__PURE__ */ new Set();
    this.eventListeners = /* @__PURE__ */ new Map();
    this.logger = void 0;
    this._processingStatus = ProcessingStatus.NotStarted;
    this._parent = void 0;
    this._syncSnapshot = void 0;
    this.ref = void 0;
    this._actorScope = void 0;
    this.systemId = void 0;
    this.sessionId = void 0;
    this.system = void 0;
    this._doneEvent = void 0;
    this.src = void 0;
    this._deferred = [];
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    };
    const {
      clock,
      logger,
      parent,
      syncSnapshot,
      id,
      systemId,
      inspect
    } = resolvedOptions;
    this.system = parent ? parent.system : createSystem(this, {
      clock,
      logger
    });
    if (inspect && !parent) {
      this.system.inspect(toObserver(inspect));
    }
    this.sessionId = this.system._bookId();
    this.id = id ?? this.sessionId;
    this.logger = options?.logger ?? this.system._logger;
    this.clock = options?.clock ?? this.system._clock;
    this._parent = parent;
    this._syncSnapshot = syncSnapshot;
    this.options = resolvedOptions;
    this.src = resolvedOptions.src ?? logic;
    this.ref = this;
    this._actorScope = {
      self: this,
      id: this.id,
      sessionId: this.sessionId,
      logger: this.logger,
      defer: (fn) => {
        this._deferred.push(fn);
      },
      system: this.system,
      stopChild: (child) => {
        if (child._parent !== this) {
          throw new Error(`Cannot stop child actor ${child.id} of ${this.id} because it is not a child`);
        }
        child._stop();
      },
      emit: (emittedEvent) => {
        const listeners = this.eventListeners.get(emittedEvent.type);
        const wildcardListener = this.eventListeners.get("*");
        if (!listeners && !wildcardListener) {
          return;
        }
        const allListeners = [...listeners ? listeners.values() : [], ...wildcardListener ? wildcardListener.values() : []];
        for (const handler of allListeners) {
          try {
            handler(emittedEvent);
          } catch (err) {
            reportUnhandledError(err);
          }
        }
      },
      actionExecutor: (action) => {
        const exec = () => {
          this._actorScope.system._sendInspectionEvent({
            type: "@xstate.action",
            actorRef: this,
            action: {
              type: action.type,
              params: action.params
            }
          });
          if (!action.exec) {
            return;
          }
          const saveExecutingCustomAction = executingCustomAction;
          try {
            executingCustomAction = true;
            action.exec(action.info, action.params);
          } finally {
            executingCustomAction = saveExecutingCustomAction;
          }
        };
        if (this._processingStatus === ProcessingStatus.Running) {
          exec();
        } else {
          this._deferred.push(exec);
        }
      }
    };
    this.send = this.send.bind(this);
    this.system._sendInspectionEvent({
      type: "@xstate.actor",
      actorRef: this
    });
    if (systemId) {
      this.systemId = systemId;
      this.system._set(systemId, this);
    }
    this._initState(options?.snapshot ?? options?.state);
    if (systemId && this._snapshot.status !== "active") {
      this.system._unregister(this);
    }
  }
  _initState(persistedState) {
    try {
      this._snapshot = persistedState ? this.logic.restoreSnapshot ? this.logic.restoreSnapshot(persistedState, this._actorScope) : persistedState : this.logic.getInitialSnapshot(this._actorScope, this.options?.input);
    } catch (err) {
      this._snapshot = {
        status: "error",
        output: void 0,
        error: err
      };
    }
  }
  update(snapshot, event) {
    this._snapshot = snapshot;
    let deferredFn;
    while (deferredFn = this._deferred.shift()) {
      try {
        deferredFn();
      } catch (err) {
        this._deferred.length = 0;
        this._snapshot = {
          ...snapshot,
          status: "error",
          error: err
        };
      }
    }
    switch (this._snapshot.status) {
      case "active":
        for (const observer of this.observers) {
          try {
            observer.next?.(snapshot);
          } catch (err) {
            reportUnhandledError(err);
          }
        }
        break;
      case "done":
        for (const observer of this.observers) {
          try {
            observer.next?.(snapshot);
          } catch (err) {
            reportUnhandledError(err);
          }
        }
        this._stopProcedure();
        this._complete();
        this._doneEvent = createDoneActorEvent(this.id, this._snapshot.output);
        if (this._parent) {
          this.system._relay(this, this._parent, this._doneEvent);
        }
        break;
      case "error":
        this._error(this._snapshot.error);
        break;
    }
    this.system._sendInspectionEvent({
      type: "@xstate.snapshot",
      actorRef: this,
      event,
      snapshot
    });
  }
  /**
   * Subscribe an observer to an actor’s snapshot values.
   *
   * @remarks
   * The observer will receive the actor’s snapshot value when it is emitted.
   * The observer can be:
   *
   * - A plain function that receives the latest snapshot, or
   * - An observer object whose `.next(snapshot)` method receives the latest
   *   snapshot
   *
   * @example
   *
   * ```ts
   * // Observer as a plain function
   * const subscription = actor.subscribe((snapshot) => {
   *   console.log(snapshot);
   * });
   * ```
   *
   * @example
   *
   * ```ts
   * // Observer as an object
   * const subscription = actor.subscribe({
   *   next(snapshot) {
   *     console.log(snapshot);
   *   },
   *   error(err) {
   *     // ...
   *   },
   *   complete() {
   *     // ...
   *   }
   * });
   * ```
   *
   * The return value of `actor.subscribe(observer)` is a subscription object
   * that has an `.unsubscribe()` method. You can call
   * `subscription.unsubscribe()` to unsubscribe the observer:
   *
   * @example
   *
   * ```ts
   * const subscription = actor.subscribe((snapshot) => {
   *   // ...
   * });
   *
   * // Unsubscribe the observer
   * subscription.unsubscribe();
   * ```
   *
   * When the actor is stopped, all of its observers will automatically be
   * unsubscribed.
   *
   * @param observer - Either a plain function that receives the latest
   *   snapshot, or an observer object whose `.next(snapshot)` method receives
   *   the latest snapshot
   */
  subscribe(nextListenerOrObserver, errorListener, completeListener) {
    const observer = toObserver(nextListenerOrObserver, errorListener, completeListener);
    if (this._processingStatus !== ProcessingStatus.Stopped) {
      this.observers.add(observer);
    } else {
      switch (this._snapshot.status) {
        case "done":
          try {
            observer.complete?.();
          } catch (err) {
            reportUnhandledError(err);
          }
          break;
        case "error": {
          const err = this._snapshot.error;
          if (!observer.error) {
            reportUnhandledError(err);
          } else {
            try {
              observer.error(err);
            } catch (err2) {
              reportUnhandledError(err2);
            }
          }
          break;
        }
      }
    }
    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      }
    };
  }
  on(type, handler) {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.eventListeners.set(type, listeners);
    }
    const wrappedHandler = handler.bind(void 0);
    listeners.add(wrappedHandler);
    return {
      unsubscribe: () => {
        listeners.delete(wrappedHandler);
      }
    };
  }
  select(selector, equalityFn = Object.is) {
    return {
      subscribe: (observerOrFn) => {
        const observer = toObserver(observerOrFn);
        const snapshot = this.getSnapshot();
        let previousSelected = selector(snapshot);
        return this.subscribe((snapshot2) => {
          const nextSelected = selector(snapshot2);
          if (!equalityFn(previousSelected, nextSelected)) {
            previousSelected = nextSelected;
            observer.next?.(nextSelected);
          }
        });
      },
      get: () => selector(this.getSnapshot())
    };
  }
  /** Starts the Actor from the initial state */
  start() {
    if (this._processingStatus === ProcessingStatus.Running) {
      return this;
    }
    if (this._syncSnapshot) {
      this.subscribe({
        next: (snapshot) => {
          if (snapshot.status === "active") {
            this.system._relay(this, this._parent, {
              type: `xstate.snapshot.${this.id}`,
              snapshot
            });
          }
        },
        error: () => {
        }
      });
    }
    this.system._register(this.sessionId, this);
    if (this.systemId) {
      this.system._set(this.systemId, this);
    }
    this._processingStatus = ProcessingStatus.Running;
    const initEvent = createInitEvent(this.options.input);
    this.system._sendInspectionEvent({
      type: "@xstate.event",
      sourceRef: this._parent,
      actorRef: this,
      event: initEvent
    });
    const status = this._snapshot.status;
    switch (status) {
      case "done":
        this.update(this._snapshot, initEvent);
        return this;
      case "error":
        this._error(this._snapshot.error);
        return this;
    }
    if (!this._parent) {
      this.system.start();
    }
    if (this.logic.start) {
      try {
        this.logic.start(this._snapshot, this._actorScope);
      } catch (err) {
        this._snapshot = {
          ...this._snapshot,
          status: "error",
          error: err
        };
        this._error(err);
        return this;
      }
    }
    this.update(this._snapshot, initEvent);
    if (this.options.devTools) {
      this.attachDevTools();
    }
    this.mailbox.start();
    return this;
  }
  _process(event) {
    let nextState;
    let caughtError;
    try {
      nextState = this.logic.transition(this._snapshot, event, this._actorScope);
    } catch (err) {
      caughtError = {
        err
      };
    }
    if (caughtError) {
      const {
        err
      } = caughtError;
      this._snapshot = {
        ...this._snapshot,
        status: "error",
        error: err
      };
      this._error(err);
      return;
    }
    this.update(nextState, event);
    if (event.type === XSTATE_STOP) {
      this._stopProcedure();
      this._complete();
    }
  }
  _stop() {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      return this;
    }
    this.mailbox.clear();
    if (this._processingStatus === ProcessingStatus.NotStarted) {
      this._processingStatus = ProcessingStatus.Stopped;
      return this;
    }
    this.mailbox.enqueue({
      type: XSTATE_STOP
    });
    return this;
  }
  /** Stops the Actor and unsubscribe all listeners. */
  stop() {
    if (this._parent) {
      throw new Error("A non-root actor cannot be stopped directly.");
    }
    return this._stop();
  }
  _complete() {
    for (const observer of this.observers) {
      try {
        observer.complete?.();
      } catch (err) {
        reportUnhandledError(err);
      }
    }
    this.observers.clear();
    this.eventListeners.clear();
  }
  _reportError(err) {
    if (!this.observers.size) {
      if (!this._parent) {
        reportUnhandledError(err);
      }
      this.eventListeners.clear();
      return;
    }
    let reportError = false;
    for (const observer of this.observers) {
      const errorListener = observer.error;
      reportError || (reportError = !errorListener);
      try {
        errorListener?.(err);
      } catch (err2) {
        reportUnhandledError(err2);
      }
    }
    this.observers.clear();
    this.eventListeners.clear();
    if (reportError) {
      reportUnhandledError(err);
    }
  }
  _error(err) {
    this._stopProcedure();
    this._reportError(err);
    if (this._parent) {
      this.system._relay(this, this._parent, createErrorActorEvent(this.id, err));
    }
  }
  // TODO: atm children don't belong entirely to the actor so
  // in a way - it's not even super aware of them
  // so we can't stop them from here but we really should!
  // right now, they are being stopped within the machine's transition
  // but that could throw and leave us with "orphaned" active actors
  _stopProcedure() {
    if (this._processingStatus !== ProcessingStatus.Running) {
      return this;
    }
    this.system.scheduler.cancelAll(this);
    this.mailbox.clear();
    this.mailbox = new Mailbox(this._process.bind(this));
    this._processingStatus = ProcessingStatus.Stopped;
    this.system._unregister(this);
    return this;
  }
  /** @internal */
  _send(event) {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      return;
    }
    this.mailbox.enqueue(event);
  }
  /**
   * Sends an event to the running Actor to trigger a transition.
   *
   * @param event The event to send
   */
  send(event) {
    this.system._relay(void 0, this, event);
  }
  attachDevTools() {
    const {
      devTools
    } = this.options;
    if (devTools) {
      const resolvedDevToolsAdapter = typeof devTools === "function" ? devTools : devToolsAdapter;
      resolvedDevToolsAdapter(this);
    }
  }
  toJSON() {
    return {
      xstate$$type: $$ACTOR_TYPE,
      id: this.id
    };
  }
  /**
   * Obtain the internal state of the actor, which can be persisted.
   *
   * @remarks
   * The internal state can be persisted from any actor, not only machines.
   *
   * Note that the persisted state is not the same as the snapshot from
   * {@link Actor.getSnapshot}. Persisted state represents the internal state of
   * the actor, while snapshots represent the actor's last emitted value.
   *
   * Can be restored with {@link ActorOptions.state}
   * @see https://stately.ai/docs/persistence
   */
  getPersistedSnapshot(options) {
    return this.logic.getPersistedSnapshot(this._snapshot, options);
  }
  [symbolObservable]() {
    return this;
  }
  /**
   * Read an actor’s snapshot synchronously.
   *
   * @remarks
   * The snapshot represent an actor's last emitted value.
   *
   * When an actor receives an event, its internal state may change. An actor
   * may emit a snapshot when a state transition occurs.
   *
   * Note that some actors, such as callback actors generated with
   * `fromCallback`, will not emit snapshots.
   * @see {@link Actor.subscribe} to subscribe to an actor’s snapshot values.
   * @see {@link Actor.getPersistedSnapshot} to persist the internal state of an actor (which is more than just a snapshot).
   */
  getSnapshot() {
    return this._snapshot;
  }
};
function createActor(logic, ...[options]) {
  return new Actor(logic, options);
}
function resolveCancel(_, snapshot, actionArgs, actionParams, {
  sendId
}) {
  const resolvedSendId = typeof sendId === "function" ? sendId(actionArgs, actionParams) : sendId;
  return [snapshot, {
    sendId: resolvedSendId
  }, void 0];
}
function executeCancel(actorScope, params) {
  actorScope.defer(() => {
    actorScope.system.scheduler.cancel(actorScope.self, params.sendId);
  });
}
function cancel(sendId) {
  function cancel2(_args, _params) {
  }
  cancel2.type = "xstate.cancel";
  cancel2.sendId = sendId;
  cancel2.resolve = resolveCancel;
  cancel2.execute = executeCancel;
  return cancel2;
}
function resolveSpawn(actorScope, snapshot, actionArgs, _actionParams, {
  id,
  systemId,
  src,
  input,
  syncSnapshot
}) {
  const logic = typeof src === "string" ? resolveReferencedActor(snapshot.machine, src) : src;
  const resolvedId = typeof id === "function" ? id(actionArgs) : id;
  let actorRef;
  let resolvedInput = void 0;
  if (logic) {
    resolvedInput = typeof input === "function" ? input({
      context: snapshot.context,
      event: actionArgs.event,
      self: actorScope.self
    }) : input;
    actorRef = createActor(logic, {
      id: resolvedId,
      src,
      parent: actorScope.self,
      syncSnapshot,
      systemId,
      input: resolvedInput
    });
  }
  return [cloneMachineSnapshot(snapshot, {
    children: {
      ...snapshot.children,
      [resolvedId]: actorRef
    }
  }), {
    id,
    systemId,
    actorRef,
    src,
    input: resolvedInput
  }, void 0];
}
function executeSpawn(actorScope, {
  actorRef
}) {
  if (!actorRef) {
    return;
  }
  actorScope.defer(() => {
    if (actorRef._processingStatus === ProcessingStatus.Stopped) {
      return;
    }
    actorRef.start();
  });
}
function spawnChild(...[src, {
  id,
  systemId,
  input,
  syncSnapshot = false
} = {}]) {
  function spawnChild2(_args, _params) {
  }
  spawnChild2.type = "xstate.spawnChild";
  spawnChild2.id = id;
  spawnChild2.systemId = systemId;
  spawnChild2.src = src;
  spawnChild2.input = input;
  spawnChild2.syncSnapshot = syncSnapshot;
  spawnChild2.resolve = resolveSpawn;
  spawnChild2.execute = executeSpawn;
  return spawnChild2;
}
function resolveStop(_, snapshot, args, actionParams, {
  actorRef
}) {
  const actorRefOrString = typeof actorRef === "function" ? actorRef(args, actionParams) : actorRef;
  const resolvedActorRef = typeof actorRefOrString === "string" ? snapshot.children[actorRefOrString] : actorRefOrString;
  let children = snapshot.children;
  if (resolvedActorRef) {
    children = {
      ...children
    };
    delete children[resolvedActorRef.id];
  }
  return [cloneMachineSnapshot(snapshot, {
    children
  }), resolvedActorRef, void 0];
}
function unregisterRecursively(actorScope, actorRef) {
  const snapshot = actorRef.getSnapshot();
  if (snapshot && "children" in snapshot) {
    for (const child of Object.values(snapshot.children)) {
      unregisterRecursively(actorScope, child);
    }
  }
  actorScope.system._unregister(actorRef);
}
function executeStop(actorScope, actorRef) {
  if (!actorRef) {
    return;
  }
  unregisterRecursively(actorScope, actorRef);
  if (actorRef._processingStatus !== ProcessingStatus.Running) {
    actorScope.stopChild(actorRef);
    return;
  }
  actorScope.defer(() => {
    actorScope.stopChild(actorRef);
  });
}
function stopChild(actorRef) {
  function stop2(_args, _params) {
  }
  stop2.type = "xstate.stopChild";
  stop2.actorRef = actorRef;
  stop2.resolve = resolveStop;
  stop2.execute = executeStop;
  return stop2;
}
function checkAnd(snapshot, {
  context,
  event
}, {
  guards
}) {
  return guards.every((guard) => evaluateGuard(guard, context, event, snapshot));
}
function and(guards) {
  function and2(_args, _params) {
    return false;
  }
  and2.check = checkAnd;
  and2.guards = guards;
  return and2;
}
function evaluateGuard(guard, context, event, snapshot) {
  const {
    machine
  } = snapshot;
  const isInline = typeof guard === "function";
  const resolved = isInline ? guard : machine.implementations.guards[typeof guard === "string" ? guard : guard.type];
  if (!isInline && !resolved) {
    throw new Error(`Guard '${typeof guard === "string" ? guard : guard.type}' is not implemented.'.`);
  }
  if (typeof resolved !== "function") {
    return evaluateGuard(resolved, context, event, snapshot);
  }
  const guardArgs = {
    context,
    event
  };
  const guardParams = isInline || typeof guard === "string" ? void 0 : "params" in guard ? typeof guard.params === "function" ? guard.params({
    context,
    event
  }) : guard.params : void 0;
  if (!("check" in resolved)) {
    return resolved(guardArgs, guardParams);
  }
  const builtinGuard = resolved;
  return builtinGuard.check(
    snapshot,
    guardArgs,
    resolved
    // this holds all params
  );
}
function isAtomicStateNode(stateNode) {
  return stateNode.type === "atomic" || stateNode.type === "final";
}
function getChildren(stateNode) {
  return Object.values(stateNode.states).filter((sn) => sn.type !== "history");
}
function getProperAncestors(stateNode, toStateNode) {
  const ancestors = [];
  if (toStateNode === stateNode) {
    return ancestors;
  }
  let m = stateNode.parent;
  while (m && m !== toStateNode) {
    ancestors.push(m);
    m = m.parent;
  }
  return ancestors;
}
function getAllStateNodes(stateNodes) {
  const nodeSet = new Set(stateNodes);
  const adjList = getAdjList(nodeSet);
  for (const s of nodeSet) {
    if (s.type === "compound" && (!adjList.get(s) || !adjList.get(s).length)) {
      getInitialStateNodesWithTheirAncestors(s).forEach((sn) => nodeSet.add(sn));
    } else {
      if (s.type === "parallel") {
        for (const child of getChildren(s)) {
          if (child.type === "history") {
            continue;
          }
          if (!nodeSet.has(child)) {
            const initialStates = getInitialStateNodesWithTheirAncestors(child);
            for (const initialStateNode of initialStates) {
              nodeSet.add(initialStateNode);
            }
          }
        }
      }
    }
  }
  for (const s of nodeSet) {
    let m = s.parent;
    while (m) {
      nodeSet.add(m);
      m = m.parent;
    }
  }
  return nodeSet;
}
function getValueFromAdj(baseNode, adjList) {
  const childStateNodes = adjList.get(baseNode);
  if (!childStateNodes) {
    return {};
  }
  if (baseNode.type === "compound") {
    const childStateNode = childStateNodes[0];
    if (childStateNode) {
      if (isAtomicStateNode(childStateNode)) {
        return childStateNode.key;
      }
    } else {
      return {};
    }
  }
  const stateValue = {};
  for (const childStateNode of childStateNodes) {
    stateValue[childStateNode.key] = getValueFromAdj(childStateNode, adjList);
  }
  return stateValue;
}
function getAdjList(stateNodes) {
  const adjList = /* @__PURE__ */ new Map();
  for (const s of stateNodes) {
    if (!adjList.has(s)) {
      adjList.set(s, []);
    }
    if (s.parent) {
      if (!adjList.has(s.parent)) {
        adjList.set(s.parent, []);
      }
      adjList.get(s.parent).push(s);
    }
  }
  return adjList;
}
function getStateValue(rootNode, stateNodes) {
  const config = getAllStateNodes(stateNodes);
  return getValueFromAdj(rootNode, getAdjList(config));
}
function isInFinalState(stateNodeSet, stateNode) {
  if (stateNode.type === "compound") {
    return getChildren(stateNode).some((s) => s.type === "final" && stateNodeSet.has(s));
  }
  if (stateNode.type === "parallel") {
    return getChildren(stateNode).every((sn) => isInFinalState(stateNodeSet, sn));
  }
  return stateNode.type === "final";
}
var isStateId = (str) => str[0] === STATE_IDENTIFIER;
function getCandidates(stateNode, receivedEventType) {
  const exactMatch = stateNode.transitions.get(receivedEventType);
  const wildcardCandidates = [...stateNode.transitions.keys()].filter((eventDescriptor) => eventDescriptor !== receivedEventType && matchesEventDescriptor(receivedEventType, eventDescriptor)).sort((a, b) => b.length - a.length).flatMap((key) => stateNode.transitions.get(key));
  return exactMatch ? [...exactMatch, ...wildcardCandidates] : wildcardCandidates;
}
function getDelayedTransitions(stateNode) {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }
  const mutateEntryExit = (delay) => {
    const afterEvent = createAfterEvent(delay, stateNode.id);
    const eventType = afterEvent.type;
    stateNode.entry.push(raise(afterEvent, {
      id: eventType,
      delay
    }));
    stateNode.exit.push(cancel(eventType));
    return eventType;
  };
  const delayedTransitions = Object.keys(afterConfig).flatMap((delay) => {
    const configTransition = afterConfig[delay];
    const resolvedTransition = typeof configTransition === "string" ? {
      target: configTransition
    } : configTransition;
    const resolvedDelay = Number.isNaN(+delay) ? delay : +delay;
    const eventType = mutateEntryExit(resolvedDelay);
    return toArray(resolvedTransition).map((transition) => ({
      ...transition,
      event: eventType,
      delay: resolvedDelay
    }));
  });
  return delayedTransitions.map((delayedTransition) => {
    const {
      delay
    } = delayedTransition;
    return {
      ...formatTransition(stateNode, delayedTransition.event, delayedTransition),
      delay
    };
  });
}
function formatTransition(stateNode, descriptor, transitionConfig) {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const reenter = transitionConfig.reenter ?? false;
  const target = resolveTarget(stateNode, normalizedTarget);
  const transition = {
    ...transitionConfig,
    actions: toArray(transitionConfig.actions),
    guard: transitionConfig.guard,
    target,
    source: stateNode,
    reenter,
    eventType: descriptor,
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: target ? target.map((t) => `#${t.id}`) : void 0
    })
  };
  return transition;
}
function formatTransitions(stateNode) {
  const transitions = /* @__PURE__ */ new Map();
  if (stateNode.config.on) {
    for (const descriptor of Object.keys(stateNode.config.on)) {
      if (descriptor === NULL_EVENT) {
        throw new Error('Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.');
      }
      const transitionsConfig = stateNode.config.on[descriptor];
      transitions.set(descriptor, toTransitionConfigArray(transitionsConfig).map((t) => formatTransition(stateNode, descriptor, t)));
    }
  }
  if (stateNode.config.onDone) {
    const descriptor = `xstate.done.state.${stateNode.id}`;
    transitions.set(descriptor, toTransitionConfigArray(stateNode.config.onDone).map((t) => formatTransition(stateNode, descriptor, t)));
  }
  for (const invokeDef of stateNode.invoke) {
    if (invokeDef.onDone) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      transitions.set(descriptor, toTransitionConfigArray(invokeDef.onDone).map((t) => formatTransition(stateNode, descriptor, t)));
    }
    if (invokeDef.onError) {
      const descriptor = `xstate.error.actor.${invokeDef.id}`;
      transitions.set(descriptor, toTransitionConfigArray(invokeDef.onError).map((t) => formatTransition(stateNode, descriptor, t)));
    }
    if (invokeDef.onSnapshot) {
      const descriptor = `xstate.snapshot.${invokeDef.id}`;
      transitions.set(descriptor, toTransitionConfigArray(invokeDef.onSnapshot).map((t) => formatTransition(stateNode, descriptor, t)));
    }
  }
  for (const delayedTransition of stateNode.after) {
    let existing = transitions.get(delayedTransition.eventType);
    if (!existing) {
      existing = [];
      transitions.set(delayedTransition.eventType, existing);
    }
    existing.push(delayedTransition);
  }
  return transitions;
}
function formatRouteTransitions(rootStateNode) {
  const routeTransitions = [];
  const collectRoutes = (states) => {
    Object.values(states).forEach((sn) => {
      if (sn.config.route && sn.config.id) {
        const routeId = sn.config.id;
        const userGuard = sn.config.route.guard;
        const routeMatches = ({
          event
        }) => event.to === `#${routeId}`;
        const transition = {
          ...sn.config.route,
          guard: userGuard ? and([routeMatches, userGuard]) : routeMatches,
          target: `#${routeId}`
        };
        routeTransitions.push(formatTransition(rootStateNode, "xstate.route", transition));
      }
      if (sn.states) {
        collectRoutes(sn.states);
      }
    });
  };
  collectRoutes(rootStateNode.states);
  if (routeTransitions.length > 0) {
    rootStateNode.transitions.set("xstate.route", routeTransitions);
  }
}
function formatInitialTransition(stateNode, _target) {
  const resolvedTarget = typeof _target === "string" ? stateNode.states[_target] : _target ? stateNode.states[_target.target] : void 0;
  if (!resolvedTarget && _target) {
    throw new Error(
      // oxlint-disable-next-line typescript/restrict-template-expressions, typescript/no-base-to-string
      `Initial state node "${_target}" not found on parent state node #${stateNode.id}`
    );
  }
  const transition = {
    source: stateNode,
    actions: !_target || typeof _target === "string" ? [] : toArray(_target.actions),
    eventType: null,
    reenter: false,
    target: resolvedTarget ? [resolvedTarget] : [],
    meta: typeof _target === "object" ? _target.meta : void 0,
    description: typeof _target === "object" ? _target.description : void 0,
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: resolvedTarget ? [`#${resolvedTarget.id}`] : []
    })
  };
  return transition;
}
function resolveTarget(stateNode, targets) {
  if (targets === void 0) {
    return void 0;
  }
  return targets.map((target) => {
    if (typeof target !== "string") {
      return target;
    }
    if (isStateId(target)) {
      return stateNode.machine.getStateNodeById(target);
    }
    const isInternalTarget = target[0] === STATE_DELIMITER;
    if (isInternalTarget && !stateNode.parent) {
      return getStateNodeByPath(stateNode, target.slice(1));
    }
    const resolvedTarget = isInternalTarget ? stateNode.key + target : target;
    if (stateNode.parent) {
      try {
        const targetStateNode = getStateNodeByPath(stateNode.parent, resolvedTarget);
        return targetStateNode;
      } catch (err) {
        throw new Error(`Invalid transition definition for state node '${stateNode.id}':
${err.message}`);
      }
    } else {
      throw new Error(`Invalid target: "${target}" is not a valid target from the root node. Did you mean ".${target}"?`);
    }
  });
}
function resolveHistoryDefaultTransition(stateNode) {
  const normalizedTarget = normalizeTarget(stateNode.config.target);
  if (!normalizedTarget) {
    if (stateNode.parent.type === "parallel") {
      return {
        target: [stateNode.parent]
      };
    }
    return stateNode.parent.initial;
  }
  return {
    target: normalizedTarget.map((t) => typeof t === "string" ? getStateNodeByPath(stateNode.parent, t) : t)
  };
}
function isHistoryNode(stateNode) {
  return stateNode.type === "history";
}
function getInitialStateNodesWithTheirAncestors(stateNode) {
  const states = getInitialStateNodes(stateNode);
  for (const initialState of states) {
    for (const ancestor of getProperAncestors(initialState, stateNode)) {
      states.add(ancestor);
    }
  }
  return states;
}
function getInitialStateNodes(stateNode) {
  const set = /* @__PURE__ */ new Set();
  function iter(descStateNode) {
    if (set.has(descStateNode)) {
      return;
    }
    set.add(descStateNode);
    if (descStateNode.type === "compound") {
      iter(descStateNode.initial.target[0]);
    } else if (descStateNode.type === "parallel") {
      for (const child of getChildren(descStateNode)) {
        iter(child);
      }
    }
  }
  iter(stateNode);
  return set;
}
function getStateNode(stateNode, stateKey) {
  if (isStateId(stateKey)) {
    return stateNode.machine.getStateNodeById(stateKey);
  }
  if (!stateNode.states) {
    throw new Error(`Unable to retrieve child state '${stateKey}' from '${stateNode.id}'; no child states exist.`);
  }
  const result = stateNode.states[stateKey];
  if (!result) {
    throw new Error(`Child state '${stateKey}' does not exist on '${stateNode.id}'`);
  }
  return result;
}
function getStateNodeByPath(stateNode, statePath) {
  if (typeof statePath === "string" && isStateId(statePath)) {
    try {
      return stateNode.machine.getStateNodeById(statePath);
    } catch {
    }
  }
  const arrayStatePath = toStatePath(statePath).slice();
  let currentStateNode = stateNode;
  while (arrayStatePath.length) {
    const key = arrayStatePath.shift();
    if (!key.length) {
      break;
    }
    currentStateNode = getStateNode(currentStateNode, key);
  }
  return currentStateNode;
}
function getStateNodes(stateNode, stateValue) {
  if (typeof stateValue === "string") {
    const childStateNode = stateNode.states[stateValue];
    if (!childStateNode) {
      throw new Error(`State '${stateValue}' does not exist on '${stateNode.id}'`);
    }
    return [stateNode, childStateNode];
  }
  const childStateKeys = Object.keys(stateValue);
  const childStateNodes = childStateKeys.map((subStateKey) => getStateNode(stateNode, subStateKey)).filter(Boolean);
  return [stateNode.machine.root, stateNode].concat(childStateNodes, childStateKeys.reduce((allSubStateNodes, subStateKey) => {
    const subStateNode = getStateNode(stateNode, subStateKey);
    if (!subStateNode) {
      return allSubStateNodes;
    }
    const subStateNodes = getStateNodes(subStateNode, stateValue[subStateKey]);
    return allSubStateNodes.concat(subStateNodes);
  }, []));
}
function transitionAtomicNode(stateNode, stateValue, snapshot, event) {
  const childStateNode = getStateNode(stateNode, stateValue);
  const next = childStateNode.next(snapshot, event);
  if (!next || !next.length) {
    return stateNode.next(snapshot, event);
  }
  return next;
}
function transitionCompoundNode(stateNode, stateValue, snapshot, event) {
  const subStateKeys = Object.keys(stateValue);
  const childStateNode = getStateNode(stateNode, subStateKeys[0]);
  const next = transitionNode(childStateNode, stateValue[subStateKeys[0]], snapshot, event);
  if (!next || !next.length) {
    return stateNode.next(snapshot, event);
  }
  return next;
}
function transitionParallelNode(stateNode, stateValue, snapshot, event) {
  const allInnerTransitions = [];
  for (const subStateKey of Object.keys(stateValue)) {
    const subStateValue = stateValue[subStateKey];
    if (!subStateValue) {
      continue;
    }
    const subStateNode = getStateNode(stateNode, subStateKey);
    const innerTransitions = transitionNode(subStateNode, subStateValue, snapshot, event);
    if (innerTransitions) {
      allInnerTransitions.push(...innerTransitions);
    }
  }
  if (!allInnerTransitions.length) {
    return stateNode.next(snapshot, event);
  }
  return allInnerTransitions;
}
function transitionNode(stateNode, stateValue, snapshot, event) {
  if (typeof stateValue === "string") {
    return transitionAtomicNode(stateNode, stateValue, snapshot, event);
  }
  if (Object.keys(stateValue).length === 1) {
    return transitionCompoundNode(stateNode, stateValue, snapshot, event);
  }
  return transitionParallelNode(stateNode, stateValue, snapshot, event);
}
function getHistoryNodes(stateNode) {
  return Object.keys(stateNode.states).map((key) => stateNode.states[key]).filter((sn) => sn.type === "history");
}
function isDescendant(childStateNode, parentStateNode) {
  let marker = childStateNode;
  while (marker.parent && marker.parent !== parentStateNode) {
    marker = marker.parent;
  }
  return marker.parent === parentStateNode;
}
function hasIntersection(s1, s2) {
  const set1 = new Set(s1);
  const set2 = new Set(s2);
  for (const item of set1) {
    if (set2.has(item)) {
      return true;
    }
  }
  for (const item of set2) {
    if (set1.has(item)) {
      return true;
    }
  }
  return false;
}
function removeConflictingTransitions(enabledTransitions, stateNodeSet, historyValue) {
  const filteredTransitions = /* @__PURE__ */ new Set();
  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = /* @__PURE__ */ new Set();
    for (const t2 of filteredTransitions) {
      if (hasIntersection(computeExitSet([t1], stateNodeSet, historyValue), computeExitSet([t2], stateNodeSet, historyValue))) {
        if (isDescendant(t1.source, t2.source)) {
          transitionsToRemove.add(t2);
        } else {
          t1Preempted = true;
          break;
        }
      }
    }
    if (!t1Preempted) {
      for (const t3 of transitionsToRemove) {
        filteredTransitions.delete(t3);
      }
      filteredTransitions.add(t1);
    }
  }
  return Array.from(filteredTransitions);
}
function findLeastCommonAncestor(stateNodes) {
  const [head, ...tail] = stateNodes;
  for (const ancestor of getProperAncestors(head, void 0)) {
    if (tail.every((sn) => isDescendant(sn, ancestor))) {
      return ancestor;
    }
  }
}
function getEffectiveTargetStates(transition, historyValue) {
  if (!transition.target) {
    return [];
  }
  const targets = /* @__PURE__ */ new Set();
  for (const targetNode of transition.target) {
    if (isHistoryNode(targetNode)) {
      if (historyValue[targetNode.id]) {
        for (const node of historyValue[targetNode.id]) {
          targets.add(node);
        }
      } else {
        for (const node of getEffectiveTargetStates(resolveHistoryDefaultTransition(targetNode), historyValue)) {
          targets.add(node);
        }
      }
    } else {
      targets.add(targetNode);
    }
  }
  return [...targets];
}
function getTransitionDomain(transition, historyValue) {
  const targetStates = getEffectiveTargetStates(transition, historyValue);
  if (!targetStates) {
    return;
  }
  if (!transition.reenter && targetStates.every((target) => target === transition.source || isDescendant(target, transition.source))) {
    return transition.source;
  }
  const lca = findLeastCommonAncestor(targetStates.concat(transition.source));
  if (lca) {
    return lca;
  }
  if (transition.reenter) {
    return;
  }
  return transition.source.machine.root;
}
function computeExitSet(transitions, stateNodeSet, historyValue) {
  const statesToExit = /* @__PURE__ */ new Set();
  for (const t of transitions) {
    if (t.target?.length) {
      const domain = getTransitionDomain(t, historyValue);
      if (t.reenter && t.source === domain) {
        statesToExit.add(domain);
      }
      for (const stateNode of stateNodeSet) {
        if (isDescendant(stateNode, domain)) {
          statesToExit.add(stateNode);
        }
      }
    }
  }
  return [...statesToExit];
}
function areStateNodeCollectionsEqual(prevStateNodes, nextStateNodeSet) {
  if (prevStateNodes.length !== nextStateNodeSet.size) {
    return false;
  }
  for (const node of prevStateNodes) {
    if (!nextStateNodeSet.has(node)) {
      return false;
    }
  }
  return true;
}
function initialMicrostep(root, preInitialState, actorScope, initEvent, internalQueue) {
  return microstep([{
    target: [...getInitialStateNodes(root)],
    source: root,
    reenter: true,
    actions: [],
    eventType: null,
    toJSON: null
  }], preInitialState, actorScope, initEvent, true, internalQueue);
}
function microstep(transitions, currentSnapshot, actorScope, event, isInitial, internalQueue) {
  const actions = [];
  if (!transitions.length) {
    return [currentSnapshot, actions];
  }
  const originalExecutor = actorScope.actionExecutor;
  actorScope.actionExecutor = (action) => {
    actions.push(action);
    originalExecutor(action);
  };
  try {
    const mutStateNodeSet = new Set(currentSnapshot._nodes);
    let historyValue = currentSnapshot.historyValue;
    const filteredTransitions = removeConflictingTransitions(transitions, mutStateNodeSet, historyValue);
    let nextState = currentSnapshot;
    if (!isInitial) {
      [nextState, historyValue] = exitStates(nextState, event, actorScope, filteredTransitions, mutStateNodeSet, historyValue, internalQueue, actorScope.actionExecutor);
    }
    nextState = resolveActionsAndContext(nextState, event, actorScope, filteredTransitions.flatMap((t) => t.actions), internalQueue, void 0);
    nextState = enterStates(nextState, event, actorScope, filteredTransitions, mutStateNodeSet, internalQueue, historyValue, isInitial);
    const nextStateNodes = [...mutStateNodeSet];
    if (nextState.status === "done") {
      nextState = resolveActionsAndContext(nextState, event, actorScope, nextStateNodes.sort((a, b) => b.order - a.order).flatMap((state) => state.exit), internalQueue, void 0);
    }
    try {
      if (historyValue === currentSnapshot.historyValue && areStateNodeCollectionsEqual(currentSnapshot._nodes, mutStateNodeSet)) {
        return [nextState, actions];
      }
      return [cloneMachineSnapshot(nextState, {
        _nodes: nextStateNodes,
        historyValue
      }), actions];
    } catch (e) {
      throw e;
    }
  } finally {
    actorScope.actionExecutor = originalExecutor;
  }
}
function getMachineOutput(snapshot, event, actorScope, rootNode, rootCompletionNode) {
  if (rootNode.output === void 0) {
    return;
  }
  const doneStateEvent = createDoneStateEvent(rootCompletionNode.id, rootCompletionNode.output !== void 0 && rootCompletionNode.parent ? resolveOutput(rootCompletionNode.output, snapshot.context, event, actorScope.self) : void 0);
  return resolveOutput(rootNode.output, snapshot.context, doneStateEvent, actorScope.self);
}
function enterStates(currentSnapshot, event, actorScope, filteredTransitions, mutStateNodeSet, internalQueue, historyValue, isInitial) {
  let nextSnapshot = currentSnapshot;
  const statesToEnter = /* @__PURE__ */ new Set();
  const statesForDefaultEntry = /* @__PURE__ */ new Set();
  computeEntrySet(filteredTransitions, historyValue, statesForDefaultEntry, statesToEnter);
  if (isInitial) {
    statesForDefaultEntry.add(currentSnapshot.machine.root);
  }
  const completedNodes = /* @__PURE__ */ new Set();
  for (const stateNodeToEnter of [...statesToEnter].sort((a, b) => a.order - b.order)) {
    mutStateNodeSet.add(stateNodeToEnter);
    const actions = [];
    actions.push(...stateNodeToEnter.entry);
    for (const invokeDef of stateNodeToEnter.invoke) {
      actions.push(spawnChild(invokeDef.src, {
        ...invokeDef,
        syncSnapshot: !!invokeDef.onSnapshot
      }));
    }
    if (statesForDefaultEntry.has(stateNodeToEnter)) {
      const initialActions = stateNodeToEnter.initial.actions;
      actions.push(...initialActions);
    }
    nextSnapshot = resolveActionsAndContext(nextSnapshot, event, actorScope, actions, internalQueue, stateNodeToEnter.invoke.map((invokeDef) => invokeDef.id));
    if (stateNodeToEnter.type === "final") {
      const parent = stateNodeToEnter.parent;
      let ancestorMarker = parent?.type === "parallel" ? parent : parent?.parent;
      let rootCompletionNode = ancestorMarker || stateNodeToEnter;
      if (parent?.type === "compound") {
        internalQueue.push(createDoneStateEvent(parent.id, stateNodeToEnter.output !== void 0 ? resolveOutput(stateNodeToEnter.output, nextSnapshot.context, event, actorScope.self) : void 0));
      }
      while (ancestorMarker?.type === "parallel" && !completedNodes.has(ancestorMarker) && isInFinalState(mutStateNodeSet, ancestorMarker)) {
        completedNodes.add(ancestorMarker);
        internalQueue.push(createDoneStateEvent(ancestorMarker.id));
        rootCompletionNode = ancestorMarker;
        ancestorMarker = ancestorMarker.parent;
      }
      if (ancestorMarker) {
        continue;
      }
      nextSnapshot = cloneMachineSnapshot(nextSnapshot, {
        status: "done",
        output: getMachineOutput(nextSnapshot, event, actorScope, nextSnapshot.machine.root, rootCompletionNode)
      });
    }
  }
  return nextSnapshot;
}
function computeEntrySet(transitions, historyValue, statesForDefaultEntry, statesToEnter) {
  for (const t of transitions) {
    const domain = getTransitionDomain(t, historyValue);
    for (const s of t.target || []) {
      if (!isHistoryNode(s) && // if the target is different than the source then it will *definitely* be entered
      (t.source !== s || // we know that the domain can't lie within the source
      // if it's different than the source then it's outside of it and it means that the target has to be entered as well
      t.source !== domain || // reentering transitions always enter the target, even if it's the source itself
      t.reenter)) {
        statesToEnter.add(s);
        statesForDefaultEntry.add(s);
      }
      addDescendantStatesToEnter(s, historyValue, statesForDefaultEntry, statesToEnter);
    }
    const targetStates = getEffectiveTargetStates(t, historyValue);
    for (const s of targetStates) {
      const ancestors = getProperAncestors(s, domain);
      if (domain?.type === "parallel") {
        ancestors.push(domain);
      }
      addAncestorStatesToEnter(statesToEnter, historyValue, statesForDefaultEntry, ancestors, !t.source.parent && t.reenter ? void 0 : domain);
    }
  }
}
function addDescendantStatesToEnter(stateNode, historyValue, statesForDefaultEntry, statesToEnter) {
  if (isHistoryNode(stateNode)) {
    if (historyValue[stateNode.id]) {
      const historyStateNodes = historyValue[stateNode.id];
      for (const s of historyStateNodes) {
        statesToEnter.add(s);
        addDescendantStatesToEnter(s, historyValue, statesForDefaultEntry, statesToEnter);
      }
      for (const s of historyStateNodes) {
        addProperAncestorStatesToEnter(s, stateNode.parent, statesToEnter, historyValue, statesForDefaultEntry);
      }
    } else {
      const historyDefaultTransition = resolveHistoryDefaultTransition(stateNode);
      for (const s of historyDefaultTransition.target) {
        statesToEnter.add(s);
        if (historyDefaultTransition === stateNode.parent?.initial) {
          statesForDefaultEntry.add(stateNode.parent);
        }
        addDescendantStatesToEnter(s, historyValue, statesForDefaultEntry, statesToEnter);
      }
      for (const s of historyDefaultTransition.target) {
        addProperAncestorStatesToEnter(s, stateNode.parent, statesToEnter, historyValue, statesForDefaultEntry);
      }
    }
  } else {
    if (stateNode.type === "compound") {
      const [initialState] = stateNode.initial.target;
      if (!isHistoryNode(initialState)) {
        statesToEnter.add(initialState);
        statesForDefaultEntry.add(initialState);
      }
      addDescendantStatesToEnter(initialState, historyValue, statesForDefaultEntry, statesToEnter);
      addProperAncestorStatesToEnter(initialState, stateNode, statesToEnter, historyValue, statesForDefaultEntry);
    } else {
      if (stateNode.type === "parallel") {
        for (const child of getChildren(stateNode).filter((sn) => !isHistoryNode(sn))) {
          if (![...statesToEnter].some((s) => isDescendant(s, child))) {
            if (!isHistoryNode(child)) {
              statesToEnter.add(child);
              statesForDefaultEntry.add(child);
            }
            addDescendantStatesToEnter(child, historyValue, statesForDefaultEntry, statesToEnter);
          }
        }
      }
    }
  }
}
function addAncestorStatesToEnter(statesToEnter, historyValue, statesForDefaultEntry, ancestors, reentrancyDomain) {
  for (const anc of ancestors) {
    if (!reentrancyDomain || isDescendant(anc, reentrancyDomain)) {
      statesToEnter.add(anc);
    }
    if (anc.type === "parallel") {
      for (const child of getChildren(anc).filter((sn) => !isHistoryNode(sn))) {
        if (![...statesToEnter].some((s) => isDescendant(s, child))) {
          statesToEnter.add(child);
          addDescendantStatesToEnter(child, historyValue, statesForDefaultEntry, statesToEnter);
        }
      }
    }
  }
}
function addProperAncestorStatesToEnter(stateNode, toStateNode, statesToEnter, historyValue, statesForDefaultEntry) {
  addAncestorStatesToEnter(statesToEnter, historyValue, statesForDefaultEntry, getProperAncestors(stateNode, toStateNode));
}
function exitStates(currentSnapshot, event, actorScope, transitions, mutStateNodeSet, historyValue, internalQueue, _actionExecutor) {
  let nextSnapshot = currentSnapshot;
  const statesToExit = computeExitSet(transitions, mutStateNodeSet, historyValue);
  statesToExit.sort((a, b) => b.order - a.order);
  let changedHistory;
  for (const exitStateNode of statesToExit) {
    for (const historyNode of getHistoryNodes(exitStateNode)) {
      let predicate;
      if (historyNode.history === "deep") {
        predicate = (sn) => isAtomicStateNode(sn) && isDescendant(sn, exitStateNode);
      } else {
        predicate = (sn) => {
          return sn.parent === exitStateNode;
        };
      }
      changedHistory ?? (changedHistory = {
        ...historyValue
      });
      changedHistory[historyNode.id] = Array.from(mutStateNodeSet).filter(predicate);
    }
  }
  for (const s of statesToExit) {
    nextSnapshot = resolveActionsAndContext(nextSnapshot, event, actorScope, [...s.exit, ...s.invoke.map((def) => stopChild(def.id))], internalQueue, void 0);
    mutStateNodeSet.delete(s);
  }
  return [nextSnapshot, changedHistory || historyValue];
}
function getAction(machine, actionType) {
  return machine.implementations.actions[actionType];
}
function resolveAndExecuteActionsWithContext(currentSnapshot, event, actorScope, actions, extra, retries) {
  const {
    machine
  } = currentSnapshot;
  let intermediateSnapshot = currentSnapshot;
  for (const action of actions) {
    const isInline = typeof action === "function";
    const resolvedAction = isInline ? action : (
      // the existing type of `.actions` assumes non-nullable `TExpressionAction`
      // it's fine to cast this here to get a common type and lack of errors in the rest of the code
      // our logic below makes sure that we call those 2 "variants" correctly
      getAction(machine, typeof action === "string" ? action : action.type)
    );
    const actionArgs = {
      context: intermediateSnapshot.context,
      event,
      self: actorScope.self,
      system: actorScope.system
    };
    const actionParams = isInline || typeof action === "string" ? void 0 : "params" in action ? typeof action.params === "function" ? action.params({
      context: intermediateSnapshot.context,
      event
    }) : action.params : void 0;
    if (!resolvedAction || !("resolve" in resolvedAction)) {
      actorScope.actionExecutor({
        type: typeof action === "string" ? action : typeof action === "object" ? action.type : action.name || "(anonymous)",
        info: actionArgs,
        params: actionParams,
        exec: resolvedAction
      });
      continue;
    }
    const builtinAction = resolvedAction;
    const [nextState, params, actions2] = builtinAction.resolve(
      actorScope,
      intermediateSnapshot,
      actionArgs,
      actionParams,
      resolvedAction,
      // this holds all params
      extra
    );
    intermediateSnapshot = nextState;
    if ("retryResolve" in builtinAction) {
      retries?.push([builtinAction, params]);
    }
    if ("execute" in builtinAction) {
      actorScope.actionExecutor({
        type: builtinAction.type,
        info: actionArgs,
        params,
        exec: builtinAction.execute.bind(null, actorScope, params)
      });
    }
    if (actions2) {
      intermediateSnapshot = resolveAndExecuteActionsWithContext(intermediateSnapshot, event, actorScope, actions2, extra, retries);
    }
  }
  return intermediateSnapshot;
}
function resolveActionsAndContext(currentSnapshot, event, actorScope, actions, internalQueue, deferredActorIds) {
  const retries = deferredActorIds ? [] : void 0;
  const nextState = resolveAndExecuteActionsWithContext(currentSnapshot, event, actorScope, actions, {
    internalQueue,
    deferredActorIds
  }, retries);
  retries?.forEach(([builtinAction, params]) => {
    builtinAction.retryResolve(actorScope, nextState, params);
  });
  return nextState;
}
function macrostep(snapshot, event, actorScope, internalQueue) {
  let nextSnapshot = snapshot;
  const microsteps = [];
  function addMicrostep(step, event2, transitions) {
    actorScope.system._sendInspectionEvent({
      type: "@xstate.microstep",
      actorRef: actorScope.self,
      event: event2,
      snapshot: step[0],
      _transitions: transitions
    });
    microsteps.push(step);
  }
  if (event.type === XSTATE_STOP) {
    nextSnapshot = cloneMachineSnapshot(stopChildren(nextSnapshot, event, actorScope), {
      status: "stopped"
    });
    addMicrostep([nextSnapshot, []], event, []);
    return {
      snapshot: nextSnapshot,
      microsteps
    };
  }
  let nextEvent = event;
  if (nextEvent.type !== XSTATE_INIT) {
    const currentEvent = nextEvent;
    const isErr = isErrorActorEvent(currentEvent);
    const transitions = selectTransitions(currentEvent, nextSnapshot);
    if (isErr && !transitions.length) {
      nextSnapshot = cloneMachineSnapshot(stopChildren(nextSnapshot, currentEvent, actorScope), {
        status: "error",
        error: currentEvent.error
      });
      addMicrostep([nextSnapshot, []], currentEvent, []);
      return {
        snapshot: nextSnapshot,
        microsteps
      };
    }
    const step = microstep(
      transitions,
      snapshot,
      actorScope,
      nextEvent,
      false,
      // isInitial
      internalQueue
    );
    nextSnapshot = step[0];
    addMicrostep(step, currentEvent, transitions);
  }
  let shouldSelectEventlessTransitions = true;
  const maxIterations = snapshot.machine.options?.maxIterations ?? Infinity;
  let iterationCount = 0;
  while (nextSnapshot.status === "active") {
    iterationCount++;
    if (iterationCount > maxIterations) {
      throw new Error(`Infinite loop detected: the machine has processed more than ${maxIterations} microsteps without reaching a stable state. This usually happens when there's a cycle of transitions (e.g., eventless transitions or raised events causing state A -> B -> C -> A).`);
    }
    let enabledTransitions = shouldSelectEventlessTransitions ? selectEventlessTransitions(nextSnapshot, nextEvent) : [];
    const previousState = enabledTransitions.length ? nextSnapshot : void 0;
    if (!enabledTransitions.length) {
      if (!internalQueue.length) {
        break;
      }
      nextEvent = internalQueue.shift();
      enabledTransitions = selectTransitions(nextEvent, nextSnapshot);
    }
    const step = microstep(enabledTransitions, nextSnapshot, actorScope, nextEvent, false, internalQueue);
    nextSnapshot = step[0];
    shouldSelectEventlessTransitions = nextSnapshot !== previousState;
    addMicrostep(step, nextEvent, enabledTransitions);
  }
  if (nextSnapshot.status !== "active") {
    stopChildren(nextSnapshot, nextEvent, actorScope);
  }
  return {
    snapshot: nextSnapshot,
    microsteps
  };
}
function stopChildren(nextState, event, actorScope) {
  return resolveActionsAndContext(nextState, event, actorScope, Object.values(nextState.children).map((child) => stopChild(child)), [], void 0);
}
function selectTransitions(event, nextState) {
  return nextState.machine.getTransitionData(nextState, event);
}
function selectEventlessTransitions(nextState, event) {
  const enabledTransitionSet = /* @__PURE__ */ new Set();
  const atomicStates = nextState._nodes.filter(isAtomicStateNode);
  for (const stateNode of atomicStates) {
    loop: for (const s of [stateNode].concat(getProperAncestors(stateNode, void 0))) {
      if (!s.always) {
        continue;
      }
      for (const transition of s.always) {
        if (transition.guard === void 0 || evaluateGuard(transition.guard, nextState.context, event, nextState)) {
          enabledTransitionSet.add(transition);
          break loop;
        }
      }
    }
  }
  return removeConflictingTransitions(Array.from(enabledTransitionSet), new Set(nextState._nodes), nextState.historyValue);
}
function resolveStateValue(rootNode, stateValue) {
  const allStateNodes = getAllStateNodes(getStateNodes(rootNode, stateValue));
  return getStateValue(rootNode, [...allStateNodes]);
}
function isMachineSnapshot(value) {
  return !!value && typeof value === "object" && "machine" in value && "value" in value;
}
var machineSnapshotMatches = function matches(testValue) {
  return matchesState(testValue, this.value);
};
var machineSnapshotHasTag = function hasTag(tag) {
  return this.tags.has(tag);
};
var machineSnapshotCan = function can(event) {
  const transitionData = this.machine.getTransitionData(this, event);
  return !!transitionData?.length && // Check that at least one transition is not forbidden
  transitionData.some((t) => t.target !== void 0 || t.actions.length);
};
var machineSnapshotToJSON = function toJSON() {
  const {
    _nodes: nodes,
    tags,
    machine,
    getMeta: getMeta2,
    toJSON: toJSON2,
    can: can2,
    hasTag: hasTag2,
    matches: matches2,
    ...jsonValues
  } = this;
  return {
    ...jsonValues,
    tags: Array.from(tags)
  };
};
var machineSnapshotGetMeta = function getMeta() {
  return this._nodes.reduce((acc, stateNode) => {
    if (stateNode.meta !== void 0) {
      acc[stateNode.id] = stateNode.meta;
    }
    return acc;
  }, {});
};
function createMachineSnapshot(config, machine) {
  return {
    status: config.status,
    output: config.output,
    error: config.error,
    machine,
    context: config.context,
    _nodes: config._nodes,
    value: getStateValue(machine.root, config._nodes),
    tags: new Set(config._nodes.flatMap((sn) => sn.tags)),
    children: config.children,
    historyValue: config.historyValue || {},
    matches: machineSnapshotMatches,
    hasTag: machineSnapshotHasTag,
    can: machineSnapshotCan,
    getMeta: machineSnapshotGetMeta,
    toJSON: machineSnapshotToJSON
  };
}
function cloneMachineSnapshot(snapshot, config = {}) {
  return createMachineSnapshot({
    ...snapshot,
    ...config
  }, snapshot.machine);
}
function serializeHistoryValue(historyValue) {
  if (typeof historyValue !== "object" || historyValue === null) {
    return {};
  }
  const result = {};
  for (const key in historyValue) {
    const value = historyValue[key];
    if (Array.isArray(value)) {
      result[key] = value.map((item) => ({
        id: item.id
      }));
    }
  }
  return result;
}
function getPersistedSnapshot(snapshot, options) {
  const {
    _nodes: nodes,
    tags,
    machine,
    children,
    context,
    can: can2,
    hasTag: hasTag2,
    matches: matches2,
    getMeta: getMeta2,
    toJSON: toJSON2,
    ...jsonValues
  } = snapshot;
  const childrenJson = {};
  for (const id in children) {
    const child = children[id];
    childrenJson[id] = {
      snapshot: child.getPersistedSnapshot(options),
      src: child.src,
      systemId: child.systemId,
      syncSnapshot: child._syncSnapshot
    };
  }
  const persisted = {
    ...jsonValues,
    context: persistContext(context),
    children: childrenJson,
    historyValue: serializeHistoryValue(jsonValues.historyValue)
  };
  return persisted;
}
function persistContext(contextPart) {
  let copy;
  for (const key in contextPart) {
    const value = contextPart[key];
    if (value && typeof value === "object") {
      if ("sessionId" in value && "send" in value && "ref" in value) {
        copy ?? (copy = Array.isArray(contextPart) ? contextPart.slice() : {
          ...contextPart
        });
        copy[key] = {
          xstate$$type: $$ACTOR_TYPE,
          id: value.id
        };
      } else {
        const result = persistContext(value);
        if (result !== value) {
          copy ?? (copy = Array.isArray(contextPart) ? contextPart.slice() : {
            ...contextPart
          });
          copy[key] = result;
        }
      }
    }
  }
  return copy ?? contextPart;
}
function resolveRaise(_, snapshot, args, actionParams, {
  event: eventOrExpr,
  id,
  delay
}, {
  internalQueue
}) {
  const delaysMap = snapshot.machine.implementations.delays;
  if (typeof eventOrExpr === "string") {
    throw new Error(
      // oxlint-disable-next-line typescript/restrict-template-expressions
      `Only event objects may be used with raise; use raise({ type: "${eventOrExpr}" }) instead`
    );
  }
  const resolvedEvent = typeof eventOrExpr === "function" ? eventOrExpr(args, actionParams) : eventOrExpr;
  let resolvedDelay;
  if (typeof delay === "string") {
    const configDelay = delaysMap && delaysMap[delay];
    resolvedDelay = typeof configDelay === "function" ? configDelay(args, actionParams) : configDelay;
  } else {
    resolvedDelay = typeof delay === "function" ? delay(args, actionParams) : delay;
  }
  if (typeof resolvedDelay !== "number") {
    internalQueue.push(resolvedEvent);
  }
  return [snapshot, {
    event: resolvedEvent,
    id,
    delay: resolvedDelay
  }, void 0];
}
function executeRaise(actorScope, params) {
  const {
    event,
    delay,
    id
  } = params;
  if (typeof delay === "number") {
    actorScope.defer(() => {
      const self2 = actorScope.self;
      actorScope.system.scheduler.schedule(self2, self2, event, delay, id);
    });
    return;
  }
}
function raise(eventOrExpr, options) {
  function raise2(_args, _params) {
  }
  raise2.type = "xstate.raise";
  raise2.event = eventOrExpr;
  raise2.id = options?.id;
  raise2.delay = options?.delay;
  raise2.resolve = resolveRaise;
  raise2.execute = executeRaise;
  return raise2;
}

// node_modules/xstate/dist/assign-1f0d7720.esm.js
function createSpawner(actorScope, {
  machine,
  context
}, event, spawnedChildren) {
  const spawn = (src, options) => {
    if (typeof src === "string") {
      const logic = resolveReferencedActor(machine, src);
      if (!logic) {
        throw new Error(`Actor logic '${src}' not implemented in machine '${machine.id}'`);
      }
      const actorRef = createActor(logic, {
        id: options?.id,
        parent: actorScope.self,
        syncSnapshot: options?.syncSnapshot,
        input: typeof options?.input === "function" ? options.input({
          context,
          event,
          self: actorScope.self
        }) : options?.input,
        src,
        systemId: options?.systemId
      });
      spawnedChildren[actorRef.id] = actorRef;
      return actorRef;
    } else {
      const actorRef = createActor(src, {
        id: options?.id,
        parent: actorScope.self,
        syncSnapshot: options?.syncSnapshot,
        input: options?.input,
        src,
        systemId: options?.systemId
      });
      return actorRef;
    }
  };
  return (src, options) => {
    const actorRef = spawn(src, options);
    spawnedChildren[actorRef.id] = actorRef;
    actorScope.defer(() => {
      if (actorRef._processingStatus === ProcessingStatus.Stopped) {
        return;
      }
      actorRef.start();
    });
    return actorRef;
  };
}
function resolveAssign(actorScope, snapshot, actionArgs, actionParams, {
  assignment
}) {
  if (!snapshot.context) {
    throw new Error("Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.");
  }
  const spawnedChildren = {};
  const assignArgs = {
    context: snapshot.context,
    event: actionArgs.event,
    spawn: createSpawner(actorScope, snapshot, actionArgs.event, spawnedChildren),
    self: actorScope.self,
    system: actorScope.system
  };
  let partialUpdate = {};
  if (typeof assignment === "function") {
    partialUpdate = assignment(assignArgs, actionParams);
  } else {
    for (const key of Object.keys(assignment)) {
      const propAssignment = assignment[key];
      partialUpdate[key] = typeof propAssignment === "function" ? propAssignment(assignArgs, actionParams) : propAssignment;
    }
  }
  const updatedContext = Object.assign({}, snapshot.context, partialUpdate);
  return [cloneMachineSnapshot(snapshot, {
    context: updatedContext,
    children: Object.keys(spawnedChildren).length ? {
      ...snapshot.children,
      ...spawnedChildren
    } : snapshot.children
  }), void 0, void 0];
}
function assign(assignment) {
  function assign2(_args, _params) {
  }
  assign2.type = "xstate.assign";
  assign2.assignment = assignment;
  assign2.resolve = resolveAssign;
  return assign2;
}

// node_modules/xstate/dist/StateMachine-ae06a22b.esm.js
var cache = /* @__PURE__ */ new WeakMap();
function memo(object, key, fn) {
  let memoizedData = cache.get(object);
  if (!memoizedData) {
    memoizedData = {
      [key]: fn()
    };
    cache.set(object, memoizedData);
  } else if (!(key in memoizedData)) {
    memoizedData[key] = fn();
  }
  return memoizedData[key];
}
var EMPTY_OBJECT = {};
var toSerializableAction = (action) => {
  if (typeof action === "string") {
    return {
      type: action
    };
  }
  if (typeof action === "function") {
    if ("resolve" in action) {
      return {
        type: action.type
      };
    }
    return {
      type: action.name
    };
  }
  return action;
};
var StateNode = class _StateNode {
  constructor(config, options) {
    this.config = config;
    this.key = void 0;
    this.id = void 0;
    this.type = void 0;
    this.path = void 0;
    this.states = void 0;
    this.history = void 0;
    this.entry = void 0;
    this.exit = void 0;
    this.parent = void 0;
    this.machine = void 0;
    this.meta = void 0;
    this.output = void 0;
    this.order = -1;
    this.description = void 0;
    this.tags = [];
    this.transitions = void 0;
    this.always = void 0;
    this.parent = options._parent;
    this.key = options._key;
    this.machine = options._machine;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.id = this.config.id || [this.machine.id, ...this.path].join(STATE_DELIMITER);
    this.type = this.config.type || (this.config.states && Object.keys(this.config.states).length ? "compound" : this.config.history ? "history" : "atomic");
    this.description = this.config.description;
    this.order = this.machine.idMap.size;
    this.machine.idMap.set(this.id, this);
    this.states = this.config.states ? mapValues(this.config.states, (stateConfig, key) => {
      const stateNode = new _StateNode(stateConfig, {
        _parent: this,
        _key: key,
        _machine: this.machine
      });
      return stateNode;
    }) : EMPTY_OBJECT;
    if (this.type === "compound" && !this.config.initial) {
      throw new Error(`No initial state specified for compound state node "#${this.id}". Try adding { initial: "${Object.keys(this.states)[0]}" } to the state config.`);
    }
    this.history = this.config.history === true ? "shallow" : this.config.history || false;
    this.entry = toArray(this.config.entry).slice();
    this.exit = toArray(this.config.exit).slice();
    this.meta = this.config.meta;
    this.output = this.type === "final" || !this.parent ? this.config.output : void 0;
    this.tags = toArray(config.tags).slice();
  }
  /** @internal */
  _initialize() {
    this.transitions = formatTransitions(this);
    if (this.config.always) {
      this.always = toTransitionConfigArray(this.config.always).map((t) => formatTransition(this, NULL_EVENT, t));
    }
    Object.keys(this.states).forEach((key) => {
      this.states[key]._initialize();
    });
  }
  /** The well-structured state node definition. */
  get definition() {
    return {
      id: this.id,
      key: this.key,
      version: this.machine.version,
      type: this.type,
      initial: this.initial ? {
        target: this.initial.target,
        source: this,
        actions: this.initial.actions.map(toSerializableAction),
        eventType: null,
        reenter: false,
        meta: this.initial.meta,
        description: this.initial.description,
        toJSON: () => ({
          target: this.initial.target.map((t) => `#${t.id}`),
          source: `#${this.id}`,
          actions: this.initial.actions.map(toSerializableAction),
          eventType: null,
          meta: this.initial.meta,
          description: this.initial.description
        })
      } : void 0,
      history: this.history,
      states: mapValues(this.states, (state) => state.definition),
      on: this.on,
      transitions: [...this.transitions.values()].flat().map((t) => ({
        ...t,
        actions: t.actions.map(toSerializableAction)
      })),
      entry: this.entry.map(toSerializableAction),
      exit: this.exit.map(toSerializableAction),
      meta: this.meta,
      order: this.order || -1,
      output: this.output,
      invoke: this.invoke,
      description: this.description,
      tags: this.tags
    };
  }
  /** @internal */
  toJSON() {
    return this.definition;
  }
  /** The logic invoked as actors by this state node. */
  get invoke() {
    return memo(this, "invoke", () => toArray(this.config.invoke).map((invokeConfig, i) => {
      const {
        src,
        systemId
      } = invokeConfig;
      const resolvedId = invokeConfig.id ?? createInvokeId(this.id, i);
      const sourceName = typeof src === "string" ? src : `xstate.invoke.${createInvokeId(this.id, i)}`;
      return {
        ...invokeConfig,
        src: sourceName,
        id: resolvedId,
        systemId,
        toJSON() {
          const {
            onDone,
            onError,
            ...invokeDefValues
          } = invokeConfig;
          return {
            ...invokeDefValues,
            type: "xstate.invoke",
            src: sourceName,
            id: resolvedId
          };
        }
      };
    }));
  }
  /** The mapping of events to transitions. */
  get on() {
    return memo(this, "on", () => {
      const transitions = this.transitions;
      return [...transitions].flatMap(([descriptor, t]) => t.map((t2) => [descriptor, t2])).reduce((map, [descriptor, transition]) => {
        map[descriptor] = map[descriptor] || [];
        map[descriptor].push(transition);
        return map;
      }, {});
    });
  }
  get after() {
    return memo(this, "delayedTransitions", () => getDelayedTransitions(this));
  }
  get initial() {
    return memo(this, "initial", () => formatInitialTransition(this, this.config.initial));
  }
  /** @internal */
  next(snapshot, event) {
    const eventType = event.type;
    const actions = [];
    let selectedTransition;
    const candidates = memo(this, `candidates-${eventType}`, () => getCandidates(this, eventType));
    for (const candidate of candidates) {
      const {
        guard
      } = candidate;
      const resolvedContext = snapshot.context;
      let guardPassed = false;
      try {
        guardPassed = !guard || evaluateGuard(guard, resolvedContext, event, snapshot);
      } catch (err) {
        const guardType = typeof guard === "string" ? guard : typeof guard === "object" ? guard.type : void 0;
        throw new Error(`Unable to evaluate guard ${guardType ? `'${guardType}' ` : ""}in transition for event '${eventType}' in state node '${this.id}':
${err.message}`);
      }
      if (guardPassed) {
        actions.push(...candidate.actions);
        selectedTransition = candidate;
        break;
      }
    }
    return selectedTransition ? [selectedTransition] : void 0;
  }
  /** All the event types accepted by this state node and its descendants. */
  get events() {
    return memo(this, "events", () => {
      const {
        states
      } = this;
      const events = new Set(this.ownEvents);
      if (states) {
        for (const stateId of Object.keys(states)) {
          const state = states[stateId];
          if (state.states) {
            for (const event of state.events) {
              events.add(`${event}`);
            }
          }
        }
      }
      return Array.from(events);
    });
  }
  /**
   * All the events that have transitions directly from this state node.
   *
   * Excludes any inert events.
   */
  get ownEvents() {
    const keys = Object.keys(Object.fromEntries(this.transitions));
    const events = new Set(keys.filter((descriptor) => {
      return this.transitions.get(descriptor).some((transition) => !(!transition.target && !transition.actions.length && !transition.reenter));
    }));
    return Array.from(events);
  }
};
var STATE_IDENTIFIER2 = "#";
var StateMachine = class _StateMachine {
  constructor(config, implementations) {
    this.config = config;
    this.version = void 0;
    this.schemas = void 0;
    this.implementations = void 0;
    this.options = void 0;
    this.__xstatenode = true;
    this.idMap = /* @__PURE__ */ new Map();
    this.root = void 0;
    this.id = void 0;
    this.states = void 0;
    this.events = void 0;
    this.id = config.id || "(machine)";
    this.implementations = {
      actors: implementations?.actors ?? {},
      actions: implementations?.actions ?? {},
      delays: implementations?.delays ?? {},
      guards: implementations?.guards ?? {}
    };
    this.version = this.config.version;
    this.schemas = this.config.schemas;
    this.options = {
      maxIterations: Infinity,
      ...this.config.options
    };
    this.transition = this.transition.bind(this);
    this.getInitialSnapshot = this.getInitialSnapshot.bind(this);
    this.getPersistedSnapshot = this.getPersistedSnapshot.bind(this);
    this.restoreSnapshot = this.restoreSnapshot.bind(this);
    this.start = this.start.bind(this);
    this.root = new StateNode(config, {
      _key: this.id,
      _machine: this
    });
    this.root._initialize();
    formatRouteTransitions(this.root);
    this.states = this.root.states;
    this.events = this.root.events;
  }
  /**
   * Clones this state machine with the provided implementations.
   *
   * @param implementations Options (`actions`, `guards`, `actors`, `delays`) to
   *   recursively merge with the existing options.
   * @returns A new `StateMachine` instance with the provided implementations.
   */
  provide(implementations) {
    const {
      actions,
      guards,
      actors,
      delays
    } = this.implementations;
    return new _StateMachine(this.config, {
      actions: {
        ...actions,
        ...implementations.actions
      },
      guards: {
        ...guards,
        ...implementations.guards
      },
      actors: {
        ...actors,
        ...implementations.actors
      },
      delays: {
        ...delays,
        ...implementations.delays
      }
    });
  }
  resolveState(config) {
    const resolvedStateValue = resolveStateValue(this.root, config.value);
    const nodeSet = getAllStateNodes(getStateNodes(this.root, resolvedStateValue));
    return createMachineSnapshot({
      _nodes: [...nodeSet],
      context: config.context || {},
      children: {},
      status: isInFinalState(nodeSet, this.root) ? "done" : config.status || "active",
      output: config.output,
      error: config.error,
      historyValue: config.historyValue
    }, this);
  }
  /**
   * Determines the next snapshot given the current `snapshot` and received
   * `event`. Calculates a full macrostep from all microsteps.
   *
   * @param snapshot The current snapshot
   * @param event The received event
   */
  transition(snapshot, event, actorScope) {
    return macrostep(snapshot, event, actorScope, []).snapshot;
  }
  /**
   * Determines the next state given the current `state` and `event`. Calculates
   * a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  microstep(snapshot, event, actorScope) {
    return macrostep(snapshot, event, actorScope, []).microsteps.map(([s]) => s);
  }
  getTransitionData(snapshot, event) {
    return transitionNode(this.root, snapshot.value, snapshot, event) || [];
  }
  /**
   * The initial state _before_ evaluating any microsteps. This "pre-initial"
   * state is provided to initial actions executed in the initial state.
   *
   * @internal
   */
  _getPreInitialState(actorScope, initEvent, internalQueue) {
    const {
      context
    } = this.config;
    const preInitial = createMachineSnapshot({
      context: typeof context !== "function" && context ? context : {},
      _nodes: [this.root],
      children: {},
      status: "active"
    }, this);
    if (typeof context === "function") {
      const assignment = ({
        spawn,
        event,
        self: self2
      }) => context({
        spawn,
        input: event.input,
        self: self2
      });
      return resolveActionsAndContext(preInitial, initEvent, actorScope, [assign(assignment)], internalQueue, void 0);
    }
    return preInitial;
  }
  /**
   * Returns the initial `State` instance, with reference to `self` as an
   * `ActorRef`.
   */
  getInitialSnapshot(actorScope, input) {
    const initEvent = createInitEvent(input);
    const internalQueue = [];
    let snapshot = createMachineSnapshot({
      context: typeof this.config.context !== "function" && this.config.context ? this.config.context : {},
      _nodes: [this.root],
      children: {},
      status: "active"
    }, this);
    try {
      snapshot = this._getPreInitialState(actorScope, initEvent, internalQueue);
      const [nextState] = initialMicrostep(this.root, snapshot, actorScope, initEvent, internalQueue);
      const {
        snapshot: macroState
      } = macrostep(nextState, initEvent, actorScope, internalQueue);
      return macroState;
    } catch (error) {
      return cloneMachineSnapshot(snapshot, {
        status: "error",
        error
      });
    }
  }
  start(snapshot) {
    Object.values(snapshot.children).forEach((child) => {
      if (child.getSnapshot().status === "active") {
        child.start();
      }
    });
  }
  getStateNodeById(stateId) {
    const fullPath = toStatePath(stateId);
    const relativePath = fullPath.slice(1);
    const resolvedStateId = isStateId(fullPath[0]) ? fullPath[0].slice(STATE_IDENTIFIER2.length) : fullPath[0];
    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(`Child state node '#${resolvedStateId}' does not exist on machine '${this.id}'`);
    }
    return getStateNodeByPath(stateNode, relativePath);
  }
  get definition() {
    return this.root.definition;
  }
  toJSON() {
    return this.definition;
  }
  getPersistedSnapshot(snapshot, options) {
    return getPersistedSnapshot(snapshot, options);
  }
  restoreSnapshot(snapshot, _actorScope) {
    const children = {};
    const snapshotChildren = snapshot.children;
    Object.keys(snapshotChildren).forEach((actorId) => {
      const actorData = snapshotChildren[actorId];
      const childState = actorData.snapshot;
      const src = actorData.src;
      const logic = typeof src === "string" ? resolveReferencedActor(this, src) : src;
      if (!logic) {
        return;
      }
      const actorRef = createActor(logic, {
        id: actorId,
        parent: _actorScope.self,
        syncSnapshot: actorData.syncSnapshot,
        snapshot: childState,
        src,
        systemId: actorData.systemId
      });
      children[actorId] = actorRef;
    });
    function resolveHistoryReferencedState(root, referenced) {
      if (referenced instanceof StateNode) {
        return referenced;
      }
      try {
        return root.machine.getStateNodeById(referenced.id);
      } catch {
      }
    }
    function reviveHistoryValue(root, historyValue) {
      if (!historyValue || typeof historyValue !== "object") {
        return {};
      }
      const revived = {};
      for (const key in historyValue) {
        const arr = historyValue[key];
        for (const item of arr) {
          const resolved = resolveHistoryReferencedState(root, item);
          if (!resolved) {
            continue;
          }
          revived[key] ?? (revived[key] = []);
          revived[key].push(resolved);
        }
      }
      return revived;
    }
    const revivedHistoryValue = reviveHistoryValue(this.root, snapshot.historyValue);
    const restoredSnapshot = createMachineSnapshot({
      ...snapshot,
      children,
      _nodes: Array.from(getAllStateNodes(getStateNodes(this.root, snapshot.value))),
      historyValue: revivedHistoryValue
    }, this);
    const seen = /* @__PURE__ */ new Set();
    function reviveContext(contextPart, children2) {
      if (seen.has(contextPart)) {
        return;
      }
      seen.add(contextPart);
      for (const key in contextPart) {
        const value = contextPart[key];
        if (value && typeof value === "object") {
          if ("xstate$$type" in value && value.xstate$$type === $$ACTOR_TYPE) {
            contextPart[key] = children2[value.id];
            continue;
          }
          reviveContext(value, children2);
        }
      }
    }
    reviveContext(restoredSnapshot.context, children);
    return restoredSnapshot;
  }
};

// node_modules/xstate/dist/log-6a5e50a8.esm.js
function resolveEmit(_, snapshot, args, actionParams, {
  event: eventOrExpr
}) {
  const resolvedEvent = typeof eventOrExpr === "function" ? eventOrExpr(args, actionParams) : eventOrExpr;
  return [snapshot, {
    event: resolvedEvent
  }, void 0];
}
function executeEmit(actorScope, {
  event
}) {
  actorScope.defer(() => actorScope.emit(event));
}
function emit(eventOrExpr) {
  function emit2(_args, _params) {
  }
  emit2.type = "xstate.emit";
  emit2.event = eventOrExpr;
  emit2.resolve = resolveEmit;
  emit2.execute = executeEmit;
  return emit2;
}
var SpecialTargets = /* @__PURE__ */ (function(SpecialTargets2) {
  SpecialTargets2["Parent"] = "#_parent";
  SpecialTargets2["Internal"] = "#_internal";
  return SpecialTargets2;
})({});
function resolveSendTo(actorScope, snapshot, args, actionParams, {
  to,
  event: eventOrExpr,
  id,
  delay
}, extra) {
  const delaysMap = snapshot.machine.implementations.delays;
  if (typeof eventOrExpr === "string") {
    throw new Error(
      // oxlint-disable-next-line typescript/restrict-template-expressions
      `Only event objects may be used with sendTo; use sendTo({ type: "${eventOrExpr}" }) instead`
    );
  }
  const resolvedEvent = typeof eventOrExpr === "function" ? eventOrExpr(args, actionParams) : eventOrExpr;
  let resolvedDelay;
  if (typeof delay === "string") {
    const configDelay = delaysMap && delaysMap[delay];
    resolvedDelay = typeof configDelay === "function" ? configDelay(args, actionParams) : configDelay;
  } else {
    resolvedDelay = typeof delay === "function" ? delay(args, actionParams) : delay;
  }
  const resolvedTarget = typeof to === "function" ? to(args, actionParams) : to;
  let targetActorRef;
  if (typeof resolvedTarget === "string") {
    if (resolvedTarget === SpecialTargets.Parent) {
      targetActorRef = actorScope.self._parent;
    } else if (resolvedTarget === SpecialTargets.Internal) {
      targetActorRef = actorScope.self;
    } else if (resolvedTarget.startsWith("#_")) {
      targetActorRef = snapshot.children[resolvedTarget.slice(2)];
    } else {
      targetActorRef = extra.deferredActorIds?.includes(resolvedTarget) ? resolvedTarget : snapshot.children[resolvedTarget];
    }
    if (!targetActorRef) {
      throw new Error(`Unable to send event to actor '${resolvedTarget}' from machine '${snapshot.machine.id}'.`);
    }
  } else {
    targetActorRef = resolvedTarget || actorScope.self;
  }
  return [snapshot, {
    to: targetActorRef,
    targetId: typeof resolvedTarget === "string" ? resolvedTarget : void 0,
    event: resolvedEvent,
    id,
    delay: resolvedDelay
  }, void 0];
}
function retryResolveSendTo(_, snapshot, params) {
  if (typeof params.to === "string") {
    params.to = snapshot.children[params.to];
  }
}
function executeSendTo(actorScope, params) {
  actorScope.defer(() => {
    const {
      to,
      event,
      delay,
      id
    } = params;
    if (typeof delay === "number") {
      actorScope.system.scheduler.schedule(actorScope.self, to, event, delay, id);
      return;
    }
    actorScope.system._relay(
      actorScope.self,
      // at this point, in a deferred task, it should already be mutated by retryResolveSendTo
      // if it initially started as a string
      to,
      event.type === XSTATE_ERROR ? createErrorActorEvent(actorScope.self.id, event.data) : event
    );
  });
}
function sendTo(to, eventOrExpr, options) {
  function sendTo2(_args, _params) {
  }
  sendTo2.type = "xstate.sendTo";
  sendTo2.to = to;
  sendTo2.event = eventOrExpr;
  sendTo2.id = options?.id;
  sendTo2.delay = options?.delay;
  sendTo2.resolve = resolveSendTo;
  sendTo2.retryResolve = retryResolveSendTo;
  sendTo2.execute = executeSendTo;
  return sendTo2;
}
function sendParent(event, options) {
  return sendTo(SpecialTargets.Parent, event, options);
}
function resolveEnqueueActions(actorScope, snapshot, args, actionParams, {
  collect
}) {
  const actions = [];
  const enqueue = function enqueue2(action) {
    actions.push(action);
  };
  enqueue.assign = (...args2) => {
    actions.push(assign(...args2));
  };
  enqueue.cancel = (...args2) => {
    actions.push(cancel(...args2));
  };
  enqueue.raise = (...args2) => {
    actions.push(raise(...args2));
  };
  enqueue.sendTo = (...args2) => {
    actions.push(sendTo(...args2));
  };
  enqueue.sendParent = (...args2) => {
    actions.push(sendParent(...args2));
  };
  enqueue.spawnChild = (...args2) => {
    actions.push(spawnChild(...args2));
  };
  enqueue.stopChild = (...args2) => {
    actions.push(stopChild(...args2));
  };
  enqueue.emit = (...args2) => {
    actions.push(emit(...args2));
  };
  collect({
    context: args.context,
    event: args.event,
    enqueue,
    check: (guard) => evaluateGuard(guard, snapshot.context, args.event, snapshot),
    self: actorScope.self,
    system: actorScope.system
  }, actionParams);
  return [snapshot, void 0, actions];
}
function enqueueActions(collect) {
  function enqueueActions2(_args, _params) {
  }
  enqueueActions2.type = "xstate.enqueueActions";
  enqueueActions2.collect = collect;
  enqueueActions2.resolve = resolveEnqueueActions;
  return enqueueActions2;
}
function resolveLog(_, snapshot, actionArgs, actionParams, {
  value,
  label
}) {
  return [snapshot, {
    value: typeof value === "function" ? value(actionArgs, actionParams) : value,
    label
  }, void 0];
}
function executeLog({
  logger
}, {
  value,
  label
}) {
  if (label) {
    logger(label, value);
  } else {
    logger(value);
  }
}
function log(value = ({
  context,
  event
}) => ({
  context,
  event
}), label) {
  function log2(_args, _params) {
  }
  log2.type = "xstate.log";
  log2.value = value;
  log2.label = label;
  log2.resolve = resolveLog;
  log2.execute = executeLog;
  return log2;
}

// node_modules/xstate/dist/xstate.esm.js
function createMachine(config, implementations) {
  return new StateMachine(config, implementations);
}
function setup({
  schemas,
  actors,
  actions,
  guards,
  delays
}) {
  return {
    assign,
    sendTo,
    raise,
    log,
    cancel,
    stopChild,
    enqueueActions,
    emit,
    spawnChild,
    createStateConfig: (config) => config,
    createAction: (fn) => fn,
    createMachine: (config) => createMachine({
      ...config,
      schemas
    }, {
      actors,
      actions,
      guards,
      delays
    }),
    extend: (extended) => setup({
      schemas,
      actors,
      actions: {
        ...actions,
        ...extended.actions
      },
      guards: {
        ...guards,
        ...extended.guards
      },
      delays: {
        ...delays,
        ...extended.delays
      }
    })
  };
}

// src/client/animation-machine.ts
var ANIMATION_STATE_NAMES = Object.freeze([
  "idle",
  "working",
  "celebrate",
  "error",
  "disappointed",
  "joy",
  "eat",
  "play",
  "drag",
  "walk",
  "sleep",
  "wake",
  "welcome",
  "think",
  "wait"
]);
var ANIMATION_BURST_STATES = Object.freeze([
  "welcome",
  "celebrate",
  "error",
  "disappointed"
]);
function normalizeAnimationInput(input = {}) {
  const now = input.now ?? Date.now();
  return {
    activity: input.activity ?? { name: "idle", until: 0 },
    dragging: input.dragging ?? false,
    walking: input.walking ?? false,
    transient: input.transient ?? null,
    sleeping: input.sleeping ?? false,
    joyUntil: input.joyUntil ?? 0,
    now,
    sessionThink: input.sessionThink ?? false,
    sessionWait: input.sessionWait ?? false,
    dragReleaseUntil: input.dragReleaseUntil ?? 0,
    workingActive: input.workingActive ?? false,
    celebrateUntil: input.celebrateUntil ?? 0
  };
}
function burstDue(context, name2) {
  return context.activity.name === name2 && context.activity.until > context.now;
}
var ANIMATION_RULES = [
  { target: "drag", guard: "dragging", when: (context) => context.dragging },
  // Drag-release buffer: hold idle for 1.5 s, but let a requested wake animation through.
  {
    target: "idle",
    guard: "dragReleaseHeld",
    when: (context) => context.dragReleaseUntil > context.now && context.transient !== "wake"
  },
  // Host event bursts (welcome/celebrate/error/disappointed) outrank interactions.
  { target: "welcome", guard: "welcomeBurst", when: (context) => burstDue(context, "welcome") },
  { target: "celebrate", guard: "celebrateBurst", when: (context) => burstDue(context, "celebrate") },
  { target: "error", guard: "errorBurst", when: (context) => burstDue(context, "error") },
  { target: "disappointed", guard: "disappointedBurst", when: (context) => burstDue(context, "disappointed") },
  { target: "eat", guard: "transientEat", when: (context) => context.transient === "eat" },
  { target: "play", guard: "transientPlay", when: (context) => context.transient === "play" },
  { target: "wake", guard: "transientWake", when: (context) => context.transient === "wake" },
  { target: "wait", guard: "sessionWait", when: (context) => context.sessionWait },
  // Local turn-completion celebration stays below approval wait and above companionship.
  { target: "celebrate", guard: "celebrateUntil", when: (context) => context.celebrateUntil > context.now },
  { target: "working", guard: "workingActive", when: (context) => context.workingActive },
  { target: "think", guard: "sessionThink", when: (context) => context.sessionThink },
  { target: "joy", guard: "joyUntil", when: (context) => context.now < context.joyUntil },
  { target: "sleep", guard: "sleeping", when: (context) => context.sleeping },
  { target: "walk", guard: "walking", when: (context) => context.walking },
  { target: "idle", guard: "idleFallback", when: () => true }
];
var ANIMATION_PRIORITY = Object.freeze(ANIMATION_RULES.map((rule) => rule.target));
var stableStates = Object.fromEntries(ANIMATION_STATE_NAMES.map((name2) => [name2, {}]));
var animationMachine = setup({
  types: {
    context: {},
    events: {}
  },
  actions: {
    remember: assign(({ event }) => normalizeAnimationInput(event.input))
  },
  guards: Object.fromEntries(ANIMATION_RULES.map((rule) => [rule.guard, ({ context }) => rule.when(context)]))
}).createMachine({
  id: "animation",
  initial: "checking",
  context: normalizeAnimationInput(),
  on: {
    UPDATE: { target: ".checking", actions: "remember" }
  },
  states: {
    checking: {
      // Guards are generated from ANIMATION_RULES, which also derives ANIMATION_PRIORITY;
      // verify-spec-states compares the documented order with that same list.
      always: ANIMATION_RULES.map(({ target, guard }) => ({ guard, target }))
    },
    ...stableStates
  }
});
function animationStateOf(snapshot) {
  const value = snapshot.value;
  return typeof value === "string" && value !== "checking" ? value : "idle";
}

// src/core/snapshot.ts
var TURN_COMPLETED_MS = 4e3;

// src/client/logic.ts
var TRANSIENT_MS = 1500;
var WAKE_MS = 3e3;
var JOY_MS = 1600;
var PLAYBACK_MODES = Object.freeze(["loop", "pingpong", "once", "blink"]);
var PLAYBACK_MIN_FRAMES = Object.freeze({
  loop: 1,
  pingpong: 2,
  once: 1,
  blink: 2
});
var WORKING_MIN_WAIT_MS = 12e3;
var WORKING_MAX_WAIT_MS = 3e4;
var WORKING_MIN_DUR_MS = 2500;
var WORKING_MAX_DUR_MS = 6e3;
var CHATTER_MIN_MS = 45e3;
var CHATTER_MAX_MS = 11e4;
var CELEBRATE_PHRASE_COOLDOWN_MS = 3e5;
function celebratePhraseDue({ lastAt, now, cooldown = CELEBRATE_PHRASE_COOLDOWN_MS }) {
  if (!Number.isFinite(lastAt) || lastAt <= 0) return true;
  return now - lastAt >= cooldown;
}
function pickPhrase(pool, { random = Math.random, avoid = null } = {}) {
  if (!Array.isArray(pool)) return null;
  const lines = pool.filter((line) => typeof line === "string" && line.trim() !== "");
  if (lines.length === 0) return null;
  let index = Math.floor(random() * lines.length);
  if (index < 0 || index >= lines.length) index = 0;
  if (lines.length > 1 && lines[index] === avoid) index = (index + 1) % lines.length;
  return lines[index] ?? null;
}
function nextChatterAt({ now, random = Math.random }) {
  return now + CHATTER_MIN_MS + random() * (CHATTER_MAX_MS - CHATTER_MIN_MS);
}
var BLINK_MIN_INTERVAL_MS = 3e3;
var BLINK_MAX_INTERVAL_MS = 9e3;
var FACING_MIN_INTERVAL_MS = 1e4;
var FACING_MAX_INTERVAL_MS = 25e3;
function nextBlinkAt({ now, random = Math.random }) {
  const wait = BLINK_MIN_INTERVAL_MS + random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS);
  return now + wait;
}
function nextFacingAt({ now, random = Math.random }) {
  const wait = FACING_MIN_INTERVAL_MS + random() * (FACING_MAX_INTERVAL_MS - FACING_MIN_INTERVAL_MS);
  return now + wait;
}
function facingFromDrag(deltaX, currentFlip) {
  return deltaX === 0 ? currentFlip : deltaX < 0 ? 1 : -1;
}
function nextWorkingRhythm({ now, sessionThink, working, random = Math.random }) {
  if (!sessionThink) return { active: false, until: 0 };
  if (working.active) {
    const dur = WORKING_MIN_DUR_MS + random() * (WORKING_MAX_DUR_MS - WORKING_MIN_DUR_MS);
    return { active: false, until: now + dur };
  }
  const wait = WORKING_MIN_WAIT_MS + random() * (WORKING_MAX_WAIT_MS - WORKING_MIN_WAIT_MS);
  return { active: true, until: now + wait };
}
function shouldWake(prevState, nextState, ctx = {}) {
  return prevState === "sleep" && nextState !== "sleep" && !ctx.dragging && (ctx.transient ?? null) === null;
}
function wakeFromInteraction({ visuallySleeping }) {
  return { sleeping: false, wake: visuallySleeping === true };
}
function memoryLine(memory) {
  const tasks = Array.isArray(memory?.tasks) ? memory.tasks : [];
  const labels = tasks.filter((t) => t !== null && typeof t === "object" && t.ok !== false && typeof t.label === "string" && t.label !== "").flatMap((t) => typeof t.label === "string" ? [t.label] : []);
  if (labels.length === 0) return null;
  const clip = (s) => s.length > 16 ? `${s.slice(0, 16)}\u2026` : s;
  const shown = labels.slice(-2).map((l) => `\xAB${clip(l)}\xBB`).join(", ");
  const more = labels.length > 2 ? ` \u2014 \u0432\u0441\u0435\u0433\u043E ${labels.length}` : "";
  const branch = (memory?.distance ?? 0) > 0 ? "\u0412 \u043F\u0440\u043E\u0448\u043B\u043E\u0439 \u0432\u0435\u0442\u043A\u0435 \u0432\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B\u0438" : "\u0412 \u043F\u0440\u043E\u0448\u043B\u044B\u0439 \u0440\u0430\u0437 \u0432\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B\u0438";
  return `${branch} ${shown}${more}`;
}
function shouldDimForDialogs(list) {
  return (Array.isArray(list) ? list : []).some((dialog) => dialog !== null && typeof dialog === "object" && dialog.ownedByPet !== true && dialog.visible === true);
}
function chatBubbleDuration(text, configuredMs) {
  return Math.min(12e4, Math.max(3e4, configuredMs, 25e3 + 140 * Array.from(text).length));
}
function bubbleWaitsForSpeech({ speechPending, isSpeakingBubble, isActive }) {
  return speechPending && isSpeakingBubble && isActive;
}
function voiceErrorMessage(code) {
  switch (code) {
    case "voice-subscription-unsupported":
    case "voice-subscription-unavailable":
      return "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 ChatGPT \u043D\u0435 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0439 API \u0434\u043B\u044F \u043F\u043B\u0430\u0433\u0438\u043D\u043E\u0432. \u0412\u044B\u0431\u0435\u0440\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0433\u043E\u043B\u043E\u0441 \u0438\u043B\u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0439 OpenAI API \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445.";
    case "voice-disabled":
      return "\u0413\u043E\u043B\u043E\u0441 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445. \u0412\u043A\u043B\u044E\u0447\u0438 \xAB\u0413\u043E\u043B\u043E\u0441\xBB \u0438 \u0432\u044B\u0431\u0435\u0440\u0438 \u0434\u0432\u0438\u0436\u043E\u043A openai.";
    case "voice-provider-browser":
      return "\u041C\u0438\u043A\u0440\u043E\u0444\u043E\u043D \u0447\u0435\u0440\u0435\u0437 \u0441\u0435\u0440\u0432\u0435\u0440 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0434\u0432\u0438\u0436\u043E\u043A openai: \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0433\u043E\u043B\u043E\u0441\u0430 \u0432\u044B\u0431\u0435\u0440\u0438 openai \u0438 \u0443\u043A\u0430\u0436\u0438 \u0430\u0434\u0440\u0435\u0441 TTS.";
    case "voice-config-missing":
      return "\u0413\u043E\u043B\u043E\u0441 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D: \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0432\u044B\u0431\u0435\u0440\u0438 \u0434\u0432\u0438\u0436\u043E\u043A openai \u0438 \u0430\u0434\u0440\u0435\u0441 TTS.";
    case "voice-base-url-invalid":
      return "\u0410\u0434\u0440\u0435\u0441 TTS \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439: \u043D\u0443\u0436\u0435\u043D http(s)-\u0430\u0434\u0440\u0435\u0441 \u0432\u0438\u0434\u0430 https://api.openai.com/v1.";
    case "voice-audio-empty":
      return "\u0417\u0430\u043F\u0438\u0441\u044C \u043F\u0443\u0441\u0442\u0430\u044F \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043A\u0430\u0437\u0430\u0442\u044C \u0435\u0449\u0451 \u0440\u0430\u0437.";
    case "voice-api-key-required":
      return "\u0414\u043B\u044F OpenAI API \u043D\u0443\u0436\u0435\u043D API-\u043A\u043B\u044E\u0447 \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0431\u0438\u043B\u043B\u0438\u043D\u0433. \u0417\u0430\u0434\u0430\u0439 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0443\u044E \u043A\u043B\u044E\u0447\u0430 \u0438\u0437 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u0433\u043E\u043B\u043E\u0441\u0430 \u0432 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u0438 DSH. \u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 ChatGPT \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u0435\u0442 \u043A\u043B\u044E\u0447.";
    case "tts-timeout":
      return "\u0421\u0435\u0440\u0432\u0438\u0441 \u0433\u043E\u043B\u043E\u0441\u0430 \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0432\u043E\u0432\u0440\u0435\u043C\u044F. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043E\u0437\u0432\u0443\u0447\u0438\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \u0435\u0449\u0451 \u0440\u0430\u0437.";
    case "tts-aborted":
      return "\u041E\u0437\u0432\u0443\u0447\u043A\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430.";
    case "tts-connection-failed":
      return "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u043A \u0441\u0435\u0440\u0432\u0438\u0441\u0443 \u0433\u043E\u043B\u043E\u0441\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u0430\u0434\u0440\u0435\u0441 API \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445.";
    case "tts-playback-blocked":
      return "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B \u0437\u0432\u0443\u043A. \u041D\u0430\u0436\u043C\u0438 \u043D\u0430 \u043F\u0438\u0442\u043E\u043C\u0446\u0430 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043E\u0437\u0432\u0443\u0447\u0438\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \u0435\u0449\u0451 \u0440\u0430\u0437.";
    case "tts-incomplete":
      return "\u041F\u043E\u0442\u043E\u043A \u0433\u043E\u043B\u043E\u0441\u0430 \u043F\u0440\u0435\u0440\u0432\u0430\u043B\u0441\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.";
    case "tts-invalid-audio":
    case "tts-invalid-content-type":
      return "\u0421\u0435\u0440\u0432\u0438\u0441 \u0433\u043E\u043B\u043E\u0441\u0430 \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0430\u0443\u0434\u0438\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0430\u0434\u0440\u0435\u0441 \u0438 \u043C\u043E\u0434\u0435\u043B\u044C \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445.";
    case "stt-failed":
      return "\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043B \u0440\u0435\u0447\u044C. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043A\u043B\u044E\u0447, \u0430\u0434\u0440\u0435\u0441 \u0438 \u043C\u043E\u0434\u0435\u043B\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u044F \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445.";
    case "not-allowed":
    case "service-not-allowed":
      return "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u0434\u0430\u043B \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D\u0443. \u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430.";
    case "no-speech":
      return "\u041D\u0435 \u0440\u0430\u0441\u0441\u043B\u044B\u0448\u0430\u043B\u0430. \u0421\u043A\u0430\u0436\u0438 \u0435\u0449\u0451 \u0440\u0430\u0437, \u0431\u043B\u0438\u0436\u0435 \u043A \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D\u0443.";
    case "audio-capture":
      return "\u041C\u0438\u043A\u0440\u043E\u0444\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0438\u043B\u0438 \u0437\u0430\u043D\u044F\u0442 \u0434\u0440\u0443\u0433\u0438\u043C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435\u043C.";
    case "network":
      return "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 \u0441\u0435\u0440\u0432\u0438\u0441\u043E\u043C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430.";
    case "aborted":
      return "\u0417\u0430\u043F\u0438\u0441\u044C \u043F\u0440\u0435\u0440\u0432\u0430\u043B\u0430\u0441\u044C \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437.";
    default:
      return "\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0440\u0435\u0447\u044C. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437 \u0438\u043B\u0438 \u043D\u0430\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C.";
  }
}

// src/client/conversation-machine.ts
var eventMode = (event) => event.type === "LISTEN_MANUAL" || event.type === "LISTEN_AUTO" ? event.mode : "browser";
var conversationMachine = setup({
  types: {
    context: {},
    events: {},
    input: {}
  },
  guards: {
    voiceOn: ({ context }) => context.voiceEnabled,
    voiceOff: ({ event }) => event.type === "CONFIG" && event.voiceEnabled !== true,
    voiceEnabledNow: ({ event }) => event.type === "CONFIG" && event.voiceEnabled === true,
    autoListenAllowed: ({ context }) => context.conversationMode && context.voiceEnabled && !context.userTyping
  },
  actions: {
    rememberManual: assign({ autoListening: false, listenMode: ({ event }) => eventMode(event) }),
    rememberAuto: assign({ autoListening: true, listenMode: ({ event }) => eventMode(event) }),
    forgetListen: assign({ autoListening: false }),
    updateConfig: assign({
      conversationMode: ({ event }) => event.type === "CONFIG" ? event.conversationMode : false,
      voiceEnabled: ({ event }) => event.type === "CONFIG" ? event.voiceEnabled : false,
      userTyping: ({ event }) => event.type === "CONFIG" ? event.userTyping : false
    }),
    updateTyping: assign({ userTyping: ({ event }) => event.type === "TYPING" ? event.userTyping : false })
  }
}).createMachine({
  id: "conversation",
  type: "parallel",
  context: ({ input }) => ({
    conversationMode: input.conversationMode === true,
    voiceEnabled: input.voiceEnabled === true,
    userTyping: input.userTyping === true,
    autoListening: false,
    listenMode: "browser"
  }),
  on: {
    CONFIG: { actions: "updateConfig" },
    TYPING: { actions: "updateTyping" }
  },
  states: {
    chat: {
      initial: "closed",
      states: {
        closed: { on: { OPEN: "composing" } },
        composing: { on: { SEND: "waiting", CLOSE: "closed" } },
        waiting: { on: { REPLY: "revealing", FAIL: "settled", CLOSE: "closed" } },
        revealing: { on: { REVEALED: "settled", FAIL: "settled", CLOSE: "closed" } },
        settled: { on: { COMPOSE: "composing", CLOSE: "closed" } }
      }
    },
    voice: {
      initial: "check",
      states: {
        check: {
          always: [
            { target: "idle", guard: "voiceOn" },
            { target: "off" }
          ]
        },
        off: {
          on: {
            CONFIG: { target: "idle", guard: "voiceEnabledNow" },
            // Browser speech recognition does not need TTS: a manual mic click still works when
            // voice output is disabled. Hands-free auto-listen stays gated on voiceEnabled.
            LISTEN_MANUAL: { target: "listening", actions: "rememberManual" }
          }
        },
        idle: {
          on: {
            CONFIG: { target: "off", guard: "voiceOff" },
            SPEAK_START: "speaking",
            // Capture stops before its blob is transcribed; allow the upload to claim the voice
            // region even after LISTEN_END already fired from the recorder's stop callback.
            TRANSCRIBE_START: "transcribing",
            LISTEN_MANUAL: { target: "listening", actions: "rememberManual" },
            LISTEN_AUTO: { target: "listening", guard: "autoListenAllowed", actions: "rememberAuto" }
          }
        },
        speaking: {
          on: {
            SPEAK_END: "idle",
            CANCEL: "idle",
            CONFIG: { target: "off", guard: "voiceOff", actions: "forgetListen" }
          }
        },
        listening: {
          on: {
            LISTEN_END: { target: "idle", actions: "forgetListen" },
            TRANSCRIBE_START: "transcribing",
            CANCEL: { target: "idle", actions: "forgetListen" },
            CONFIG: { target: "off", guard: "voiceOff", actions: "forgetListen" }
          }
        },
        transcribing: {
          on: {
            TRANSCRIBE_END: { target: "idle", actions: "forgetListen" },
            CANCEL: { target: "idle", actions: "forgetListen" },
            CONFIG: { target: "off", guard: "voiceOff", actions: "forgetListen" }
          }
        }
      }
    }
  }
});
function conversationFlags(snapshot) {
  const value = snapshot.value;
  const chat = value.chat ?? "closed";
  const voice = value.voice ?? "off";
  return {
    chatOpen: chat !== "closed",
    chatPending: chat === "waiting",
    textPending: chat === "waiting" || chat === "revealing",
    speechPending: voice === "speaking",
    listening: voice === "listening" && snapshot.context.listenMode === "browser",
    recording: voice === "listening" && snapshot.context.listenMode === "server",
    transcribing: voice === "transcribing",
    autoListening: snapshot.context.autoListening
  };
}
function canAutoListen(snapshot) {
  return snapshot.context.conversationMode && snapshot.context.voiceEnabled && !snapshot.context.userTyping;
}

// src/client/character.ts
var DEFAULT_ROLE_ID = "whale-girl";
function parseCharacters(manifest) {
  const raw = manifest?.characters;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const characters = {};
    for (const [id, ch] of Object.entries(raw)) {
      if (ch === null || typeof ch !== "object") continue;
      characters[id] = {
        id,
        name: typeof ch.name === "string" ? ch.name : id,
        credit: typeof ch.credit === "string" ? ch.credit : void 0,
        meta: ch.meta !== null && typeof ch.meta === "object" ? ch.meta : {},
        states: ch.states !== null && typeof ch.states === "object" ? ch.states : {}
      };
    }
    const defaultId = typeof manifest?.default === "string" && manifest.default in characters ? manifest.default : Object.keys(characters)[0] ?? DEFAULT_ROLE_ID;
    return { characters, defaultId };
  }
  return {
    characters: {
      [DEFAULT_ROLE_ID]: {
        id: DEFAULT_ROLE_ID,
        name: DEFAULT_ROLE_ID,
        credit: void 0,
        meta: {},
        states: manifest?.states !== null && typeof manifest?.states === "object" ? manifest.states : {}
      }
    },
    defaultId: DEFAULT_ROLE_ID
  };
}
function getCharacter(manifest, id) {
  return parseCharacters(manifest).characters[id] ?? null;
}
function stateOf(character, stateName) {
  return stateName === null ? void 0 : character?.states?.[stateName];
}

// src/core/routes.ts
var ROUTE_PREFIX = "/whale-girl";
var STATE_PATH = `${ROUTE_PREFIX}/state`;
var INTERACT_PATH = `${ROUTE_PREFIX}/interact`;
var CONFIG_PATH = `${ROUTE_PREFIX}/config`;
var ASSETS_PATH = `${ROUTE_PREFIX}/assets`;
var EVENTS_PATH = `${ROUTE_PREFIX}/events`;
var PRESENCE_PATH = `${ROUTE_PREFIX}/presence`;
var SESSIONS_PATH = `${ROUTE_PREFIX}/sessions`;
var UPDATE_PATH = `${ROUTE_PREFIX}/update`;
var CHAT_PATH = `${ROUTE_PREFIX}/chat`;
var VOICE_PATH = `${ROUTE_PREFIX}/voice`;
var MODELS_PATH = `${ROUTE_PREFIX}/models`;
var TRANSCRIBE_PATH = `${ROUTE_PREFIX}/transcribe`;

// src/client/settings-card.ts
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/settings-fields.ts
var CARD_FIELDS = [
  { path: "enabled", labelKey: "enabled", kind: "toggle" },
  { path: "sessionMemory", labelKey: "sessionMemory", kind: "toggle" },
  { path: "size", labelKey: "size", kind: "number", min: 64, max: 160, step: 1 },
  { path: "opacity", labelKey: "opacity", kind: "number", min: 0.2, max: 1, step: 0.05 },
  { path: "walk.enabled", labelKey: "walk", kind: "toggle" },
  { path: "sleepAfterMs", labelKey: "sleep", kind: "number", min: 5e3, max: 6e5, step: 1e3 },
  { path: "replies.feed", labelKey: "feed", kind: "lines" },
  { path: "replies.play", labelKey: "play", kind: "lines" },
  { path: "replies.idle", labelKey: "idle", kind: "lines" },
  // Voice controls: enable first, then configure OpenAI TTS and system voices.
  { path: "voice.enabled", labelKey: "voice", kind: "toggle" },
  { path: "voice.provider", labelKey: "voiceProvider", kind: "select", options: ["browser", "openai", "subscription"] },
  { path: "voice.sttModel", labelKey: "voiceSttModel", kind: "text" },
  { path: "voice.baseUrl", labelKey: "voiceBaseUrl", kind: "text" },
  { path: "voice.model", labelKey: "voiceModel", kind: "text" },
  { path: "voice.voice", labelKey: "voiceName", kind: "text" },
  { path: "voice.apiKeyEnv", labelKey: "voiceApiKeyEnv", kind: "text" },
  { path: "voice.rate", labelKey: "voiceRate", kind: "number", min: 0.5, max: 2, step: 0.1 },
  // Long-answer auto-speech is opt-in; the threshold separates short replies from answers worth
  // reading aloud. Ambient and event phrases never enter this path.
  { path: "voice.autoSpeakChat", labelKey: "voiceAutoSpeak", kind: "toggle" },
  { path: "voice.minSpeakChars", labelKey: "voiceMinSpeakChars", kind: "number", min: 0, max: 2e3, step: 10 },
  // Conversation mode resumes listening after a reply regardless of TTS/STT provider.
  { path: "voice.conversation", labelKey: "voiceConversation", kind: "toggle" },
  // Chat controls: enable, select a model (virtual chat.route writes provider and model), and
  // optionally override the built-in persona.
  { path: "chat.enabled", labelKey: "chat", kind: "toggle" },
  { path: "chat.route", labelKey: "chatModel", kind: "model" },
  { path: "chat.systemPrompt", labelKey: "chatPersona", kind: "multiline" },
  // News controls: enable, headline count, and custom RSS/Atom feeds.
  { path: "news.enabled", labelKey: "news", kind: "toggle" },
  { path: "news.maxItems", labelKey: "newsMaxItems", kind: "number", min: 1, max: 10, step: 1 },
  { path: "news.feeds", labelKey: "newsFeeds", kind: "lines" }
];
var ROUTE_SEP = "\0";
function modelKey(provider, model) {
  const providerId = typeof provider === "string" ? provider.trim() : "";
  const modelId = typeof model === "string" ? model.trim() : "";
  return providerId !== "" && modelId !== "" ? `${providerId}${ROUTE_SEP}${modelId}` : "";
}
function splitModelKey(key) {
  if (typeof key !== "string" || key === "") return null;
  const at = key.indexOf(ROUTE_SEP);
  if (at <= 0 || at === key.length - 1) return null;
  return { provider: key.slice(0, at), model: key.slice(at + 1) };
}
function leafOf(value, path) {
  let cur = value;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function sameLeaf(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
function parseLines(text) {
  return String(text ?? "").split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}
function serializeLines(lines) {
  return (Array.isArray(lines) ? lines : []).join("\n");
}
function deriveState(snap, defaults) {
  const committed = snap.value ?? {};
  const fields = {};
  for (const def of CARD_FIELDS) {
    if (def.kind === "model") {
      const route = committed.chat ?? defaults?.chat ?? {};
      const provider = route.provider !== void 0 ? route.provider : defaults?.chat?.provider;
      const model = route.model !== void 0 ? route.model : defaults?.chat?.model;
      fields[def.path] = modelKey(provider, model);
      continue;
    }
    const fromCommitted = leafOf(committed, def.path);
    fields[def.path] = fromCommitted !== void 0 ? fromCommitted : leafOf(defaults, def.path);
  }
  return {
    available: snap.status !== "unavailable",
    writable: snap.writable === true,
    fields
  };
}
async function writeField(scope, path, value) {
  let accepted = false;
  try {
    accepted = await scope.mutate([{ op: "set", path: path.split("."), value }]) === true;
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  const committed = scope.getSnapshot().value ?? {};
  if (!accepted || !sameLeaf(leafOf(committed, path), value)) {
    throw new Error(`whale-girl: \u8BBE\u7F6E\u5199\u5165\u672A\u88AB\u63A5\u53D7\uFF08${path}\uFF09`);
  }
}
async function writeFields(scope, pairs) {
  const list = (Array.isArray(pairs) ? pairs : []).filter((pair) => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" && pair[0] !== "");
  if (list.length === 0) return;
  let accepted = false;
  try {
    accepted = await scope.mutate(list.map(([path, value]) => ({
      op: "set",
      path: path.split("."),
      value
    }))) === true;
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  const committed = scope.getSnapshot().value ?? {};
  for (const [path, value] of list) {
    if (!accepted || !sameLeaf(leafOf(committed, path), value)) {
      throw new Error(`whale-girl: \u8BBE\u7F6E\u5199\u5165\u672A\u88AB\u63A5\u53D7\uFF08${path}\uFF09`);
    }
  }
}

// src/client/update-state.ts
var ROW_INITIAL = { phase: "loading", info: void 0, notice: void 0, noticeTone: "default" };
function reduceRow(state, event) {
  switch (event?.type) {
    case "check-started":
      return { ...state, phase: "loading", notice: void 0, noticeTone: "default" };
    case "checked":
      return { ...state, phase: "ready", info: event.info };
    case "check-failed":
      return { ...state, phase: "error" };
    case "update-started":
      return { ...state, phase: "updating", notice: void 0, noticeTone: "default" };
    case "settled":
      return { ...state, phase: event.phase, notice: event.notice, noticeTone: event.tone };
    default:
      return state;
  }
}
function targetOf(info) {
  const latest = info?.latest;
  if (latest === null || typeof latest !== "object") return void 0;
  if (typeof latest.commit === "string" && latest.commit !== "") return latest.commit;
  if (typeof latest.version === "string" && latest.version !== "") return latest.version;
  return void 0;
}
function currentOf(info) {
  const commit = info?.current?.commit;
  return typeof commit === "string" && commit !== "" ? commit : void 0;
}
function refOf(info) {
  const ref = info?.latest?.ref;
  return typeof ref === "string" && ref !== "" ? ref : void 0;
}
function statusOf({ info, phase, notice, target, current, translate: t }) {
  if (typeof notice === "string" && notice !== "") return notice;
  if (phase === "loading") return t("checking");
  if (phase === "updating") return t("updating");
  if (phase === "error") return t("checkFailed");
  if (info?.state === "up-to-date") return current === void 0 ? t("latest") : t("latestAt", { current });
  if (info?.state === "update-available") {
    if (target === void 0) return t("updateUnknown");
    if (info?.canUpdate !== true) return t("availableUnsupported", { target });
    const ref = refOf(info);
    if (ref !== void 0 && current !== void 0) return t("availableLocal", { target, current, ref });
    return current === void 0 ? t("available", { target }) : t("availableAt", { target, current });
  }
  if (info?.reason === "rate-limited") return t("checkRateLimited");
  if (info?.reason === "local-source") return t("localSource");
  if (info?.reason === "host-outdated") return t("hostOutdated");
  return t("updateUnknown");
}
function actionOf({ info, phase, target, translate: t, onCheck, onUpdate }) {
  const idle = { label: t("check"), disabled: false, primary: false, run: onCheck };
  if (phase === "loading") return { label: t("checking"), disabled: true, primary: false, run: onCheck };
  if (phase === "updating") return { label: t("updating"), disabled: true, primary: false, run: onCheck };
  if (phase === "ready" && info?.state === "update-available" && target !== void 0) {
    const ref = refOf(info);
    const label = ref === void 0 ? t("updateTo", { target }) : t("updateToRef", { ref });
    return info?.canUpdate === true ? { label, disabled: false, primary: true, run: onUpdate } : { label, disabled: true, primary: false, run: onCheck };
  }
  return idle;
}
function deriveUpdateRow({ info, phase, notice, noticeTone, translate, onCheck, onUpdate }) {
  const target = targetOf(info);
  const current = currentOf(info);
  return {
    status: statusOf({ info, phase, notice, target, current, translate }),
    // Notice tone follows the result: success must not appear as a red error.
    tone: typeof notice === "string" && notice !== "" && noticeTone === "error" ? "error" : "default",
    action: actionOf({ info, phase, target, translate, onCheck, onUpdate })
  };
}
var FAILURE_KEYS = {
  "tracking-not-restored": "updateFailedTracking",
  "unknown-enabled-state": "updateFailedEnabled",
  "unsupported-source": "updateFailedSource"
};
function outcomeOf(payload, translate) {
  const t = translate;
  switch (payload?.state) {
    case "restart-required":
      return { phase: "done", notice: t("updatedRestart"), tone: "default" };
    case "installed":
      return { phase: "done", notice: t("updated"), tone: "default" };
    case "overridden":
      return { phase: "done", notice: t("updatedOverridden"), tone: "default" };
    case "unsupported":
      return { phase: "ready", notice: t("updateUnsupported"), tone: "default" };
    case "up-to-date":
      return { phase: "ready", notice: t("latest"), tone: "default" };
    // An inconclusive check from rate limiting/network is not an update failure; avoid error tone.
    case "check-failed":
      return {
        phase: "ready",
        notice: payload?.errorCode === "rate-limited" ? t("checkRateLimited") : t("checkFailed"),
        tone: "default"
      };
    default: {
      const spec = typeof payload?.pinnedSpec === "string" && payload.pinnedSpec !== "" ? payload.pinnedSpec : void 0;
      if (payload?.errorCode === "tracking-not-restored" && spec !== void 0) {
        return { phase: "ready", notice: t("updateFailedTracking", { spec }), tone: "error" };
      }
      const key = payload?.errorCode === void 0 ? void 0 : FAILURE_KEYS[payload.errorCode];
      if (key !== void 0) return { phase: "ready", notice: t(key), tone: "error" };
      const reason = [payload?.errorCode, payload?.errorDetail].filter((part) => typeof part === "string" && part !== "").join(t("reasonSeparator"));
      return {
        phase: "ready",
        notice: reason === "" ? t("updateFailed") : t("updateFailedDetail", { reason }),
        tone: "error"
      };
    }
  }
}

// src/client/settings-card.ts
var SETTINGS_NS = "settings.whale-girl";
var zh = {
  voiceBrowserOption: "\u7CFB\u7EDF\u8BED\u97F3",
  voiceApiOption: "OpenAI API\uFF08\u5355\u72EC\u8BA1\u8D39\uFF09",
  voiceSubscriptionOption: "ChatGPT \u8BA2\u9605\uFF1A\u4E0D\u652F\u6301\u97F3\u9891",
  description: "\u5C3A\u5BF8\u3001\u900F\u660E\u5EA6\u3001\u6E38\u8D70\u3001\u4F1A\u8BDD\u8BB0\u5FC6\u4E0E\u56DE\u8BDD\u6587\u6848\uFF08\u6539\u52A8\u5373\u65F6\u751F\u6548\uFF09",
  writeFailed: "\u521A\u624D\u7684\u6539\u52A8\u672A\u88AB\u63A5\u53D7\uFF0C\u5DF2\u56DE\u8BFB\u5F53\u524D\u503C\u3002",
  readOnly: "\u5F53\u524D\u90E8\u7F72\u53EA\u8BFB\uFF0C\u65E0\u6CD5\u4FEE\u6539\u3002",
  update: "\u66F4\u65B0",
  check: "\u68C0\u67E5\u66F4\u65B0\u2026",
  checking: "\u68C0\u67E5\u4E2D\u2026",
  latest: "\u5DF2\u662F\u6700\u65B0",
  latestAt: "\u5DF2\u662F\u6700\u65B0\uFF08\u5F53\u524D {current}\uFF09",
  updateTo: "\u66F4\u65B0\u5230 {target}\u2026",
  updateToRef: "\u6539\u8DDF {ref}\u2026",
  availableLocal: "\u6709\u65B0\u7248\u672C {target}\uFF08\u5F53\u524D {current}\uFF09\uFF1B\u66F4\u65B0\u4F1A\u6539\u6210\u8DDF {ref}",
  checkRateLimited: "\u4E0A\u6E38\u8BF7\u6C42\u53D7\u9650\uFF08GitHub \u9650\u6D41\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
  updateFailedEnabled: "\u66F4\u65B0\u5931\u8D25\uFF1A\u8BFB\u4E0D\u5230\u5F53\u524D\u542F\u505C\u72B6\u6001\uFF0C\u672A\u505A\u4EFB\u4F55\u6539\u52A8\u3002",
  updateFailedSource: "\u66F4\u65B0\u5931\u8D25\uFF1A\u8BA4\u4E0D\u51FA\u8FD9\u4E2A\u5B89\u88C5\u6765\u6E90\u3002",
  updateFailedTracking: "\u66F4\u65B0\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002profile \u73B0\u5728\u56FA\u5B9A\u5728 {spec}\u2014\u2014\u8981\u6062\u590D\u8DDF\u8E2A\u67D0\u6761\u5206\u652F\uFF0C\u9700\u624B\u52A8\u6539\u56DE\u8BE5\u5206\u652F\u3002",
  updating: "\u66F4\u65B0\u4E2D\u2026",
  updated: "\u5DF2\u66F4\u65B0\u3002",
  updatedRestart: "\u5DF2\u66F4\u65B0\uFF0C\u6539\u52A8\u5C06\u5728\u4E0B\u6B21\u542F\u52A8\u751F\u6548\u3002",
  updatedOverridden: "\u5DF2\u66F4\u65B0\uFF0C\u4F46\u88AB\u66F4\u9AD8\u4F18\u5148\u7EA7\u7684\u914D\u7F6E\u8986\u76D6\uFF0C\u5F53\u524D\u672A\u751F\u6548\u3002",
  updateFailed: "\u66F4\u65B0\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
  updateFailedDetail: "\u66F4\u65B0\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002\uFF08{reason}\uFF09",
  checkFailed: "\u68C0\u67E5\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
  reasonSeparator: "\uFF1A",
  updateUnsupported: "\u6B64\u90E8\u7F72\u4E0D\u652F\u6301\u5E94\u7528\u5185\u66F4\u65B0\u3002",
  updateUnknown: "\u65E0\u6CD5\u786E\u8BA4\u4E0A\u6E38\u7248\u672C\u3002",
  hostOutdated: "\u5BBF\u4E3B\u7248\u672C\u8FC7\u65E7\uFF0C\u65E0\u6CD5\u68C0\u67E5\u66F4\u65B0\uFF08\u8BF7\u5347\u7EA7 DSH\uFF09\u3002",
  localSource: "\u672C\u5730\u8DEF\u5F84\u5B89\u88C5\uFF0C\u65E0\u6CD5\u68C0\u67E5\u66F4\u65B0\u3002",
  available: "\u6709\u65B0\u7248\u672C {target}",
  availableAt: "\u6709\u65B0\u7248\u672C {target}\uFF08\u5F53\u524D {current}\uFF09",
  availableUnsupported: "\u6709\u65B0\u7248\u672C {target}\uFF0C\u4F46\u6B64\u90E8\u7F72\u4E0D\u652F\u6301\u5E94\u7528\u5185\u66F4\u65B0\u3002",
  enabled: "\u7F51\u9875\u7AEF\u663E\u793A",
  "enabled.hint": "\u5173\u95ED\u540E\u7F51\u9875\u7AEF\u5BA0\u7269\u4E0D\u6E32\u67D3\uFF08\u684C\u9762\u4F34\u4FA3\u5E76\u5B58\u65F6\u7528\uFF09\u3002",
  sessionMemory: "\u4F1A\u8BDD\u8BB0\u5FC6",
  "sessionMemory.hint": "\u5BA0\u7269\u628A\u4EFB\u52A1\u5B8C\u6210\u7B49\u91CC\u7A0B\u7891\u5199\u8FDB\u672C\u673A data/whale-girl/sessions.json\uFF08\u51E0\u5B57\u8282/\u6761\uFF09\uFF0C\u4F1A\u8BDD\u6062\u590D\u6216\u5206\u652F\uFF08fork\uFF09\u65F6\u6CBF\u4F1A\u8BDD\u8840\u7F18\u8BFB\u56DE\uFF0C\u91CD\u9022\u65F6\u8BF4\u4E00\u53E5\u4E0A\u6B21\u5B8C\u6210\u4E86\u4EC0\u4E48\u3002\n\u53EA\u5199\u672C\u673A\u6587\u4EF6\uFF1A\u4E0D\u8FDB\u6A21\u578B\u4E0A\u4E0B\u6587\u3001\u4E0D\u4E0A\u4F20\u7F51\u7EDC\uFF1B\u5173\u95ED\u5373\u505C\u6B62\u8BFB\u5199\uFF08\u6587\u4EF6\u4FDD\u7559\u5728\u672C\u673A\uFF0C\u53EF\u81EA\u884C\u5220\u9664\uFF09\u3002",
  size: "\u5C3A\u5BF8",
  "size.hint": "\u5BA0\u7269\u7ED8\u5236\u5C3A\u5BF8\uFF0864\u2013160 px\uFF09\u3002",
  opacity: "\u900F\u660E\u5EA6",
  "opacity.hint": "\u5E38\u6001\u900F\u660E\u5EA6\uFF080.2\u20131\uFF09\u3002",
  walk: "\u6E38\u8D70",
  "walk.hint": "\u5173\u95ED\u540E\u5BA0\u7269\u4E0D\u518D\u56DB\u5904\u6E38\u8D70\u3002",
  sleep: "\u7761\u7720\u7B49\u5F85",
  "sleep.hint": "\u7A7A\u95F2\u591A\u4E45\u8FDB\u5165\u7761\u7720\uFF08\u6BEB\u79D2\uFF09\u3002",
  feed: "\u6295\u5582\u56DE\u8BDD",
  "feed.hint": "\u6BCF\u884C\u4E00\u6761\uFF0C\u7A7A\u884C\u5FFD\u7565\uFF1B\u6E05\u7A7A\u56DE\u9000\u5185\u7F6E\u6587\u6848\u3002",
  play: "\u73A9\u800D\u56DE\u8BDD",
  "play.hint": "\u6BCF\u884C\u4E00\u6761\uFF0C\u7A7A\u884C\u5FFD\u7565\uFF1B\u6E05\u7A7A\u56DE\u9000\u5185\u7F6E\u6587\u6848\u3002",
  idle: "\u95F2\u804A",
  "idle.hint": "\u6BCF\u884C\u4E00\u6761\uFF0C\u7A7A\u884C\u5FFD\u7565\uFF1B\u7A7A\u5219\u4F7F\u7528\u5185\u7F6E\u6587\u6848\u3002\u5BA0\u7269\u7A7A\u95F2\u65F6\u4F1A\u968F\u673A\u8BF4\u4E00\u53E5\u3002",
  voice: "\u8BED\u97F3",
  "voice.hint": "\u6253\u5F00\u540E\u5BA0\u7269\u628A\u56DE\u7B54\u8BF4\u51FA\u6765\u3002",
  voiceProvider: "\u8BED\u97F3\u5F15\u64CE",
  "voiceProvider.hint": "browser = \u7CFB\u7EDF\u8BED\u97F3\uFF1Bopenai = \u901A\u8FC7 /audio/speech \u8C03\u7528\u7684 TTS \u6A21\u578B\u3002",
  voiceSttModel: "\u8BED\u97F3\u8BC6\u522B\u6A21\u578B",
  "voiceSttModel.hint": "\u9EA6\u514B\u98CE\u8F6C\u6587\u5B57\u7528\u7684\u6A21\u578B\uFF08\u9ED8\u8BA4 whisper-1\uFF09\uFF0C\u8D70 /audio/transcriptions\u3002",
  voiceBaseUrl: "TTS \u5730\u5740",
  "voiceBaseUrl.hint": "\u4F8B\u5982 https://api.openai.com/v1 \u6216 http://localhost:8880/v1\u3002",
  voiceModel: "TTS \u6A21\u578B",
  "voiceModel.hint": "\u4F8B\u5982 tts-1 / gpt-4o-mini-tts \u6216\u672C\u5730\u6A21\u578B\u3002",
  voiceName: "\u97F3\u8272",
  "voiceName.hint": "\u97F3\u8272\u540D/ID\uFF1B\u7559\u7A7A = \u81EA\u52A8\uFF08browser \u7528\u4FC4\u8BED\u8BED\u97F3\uFF09\u3002",
  voiceApiKeyEnv: "\u5BC6\u94A5\u53D8\u91CF",
  "voiceApiKeyEnv.hint": "\u5B58\u653E TTS \u5BC6\u94A5\u7684\u73AF\u5883\u53D8\u91CF\u540D\uFF1B\u7559\u7A7A = \u4E0D\u5E26\u9274\u6743\u3002",
  voiceRate: "\u8BED\u901F",
  "voiceRate.hint": "0.5\u20132\uFF08\u7CFB\u7EDF\u8BED\u97F3\uFF09\u3002",
  voiceAutoSpeak: "\u6717\u8BFB\u957F\u56DE\u7B54",
  "voiceAutoSpeak.hint": "\u53EA\u6717\u8BFB\u5BF9\u8BDD\u4E2D\u7684\u957F\u56DE\u7B54\uFF1B\u77ED\u53E5\u548C\u4E8B\u4EF6\u63D0\u793A\u4E0D\u51FA\u58F0\u3002\u9ED8\u8BA4\u5173\u95ED\u3002",
  voiceMinSpeakChars: "\u6717\u8BFB\u9608\u503C",
  "voiceMinSpeakChars.hint": "\u56DE\u7B54\u81F3\u5C11\u591A\u5C11\u5B57\u7B26\u624D\u6717\u8BFB\uFF080 = \u4EFB\u4F55\u975E\u7A7A\u56DE\u7B54\uFF09\u3002",
  voiceConversation: "\u8FDE\u7EED\u5BF9\u8BDD",
  "voiceConversation.hint": "\u56DE\u7B54\u540E\u7EE7\u7EED\u542C\u9EA6\u514B\u98CE\uFF0C\u4E0D\u7528\u6BCF\u6B21\u91CD\u6309\u3002",
  chat: "\u5BF9\u8BDD",
  "chat.hint": "\u663E\u793A\u300C\u041F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C\u300D\u6309\u94AE\u5E76\u5141\u8BB8\u4E0E\u5BA0\u7269\u5BF9\u8BDD\u3002",
  chatModel: "\u5BF9\u8BDD\u6A21\u578B",
  "chatModel.hint": "\u5BA0\u7269\u56DE\u590D\u6240\u7528\u7684\u63D0\u4F9B\u65B9/\u6A21\u578B\uFF1B\u7559\u7A7A = \u5BBF\u4E3B\u7684\u9ED8\u8BA4\u6A21\u578B\u3002",
  chatModelDefault: "\u9ED8\u8BA4\uFF08\u5BBF\u4E3B\u6A21\u578B\uFF09",
  chatPersona: "\u4EBA\u8BBE",
  "chatPersona.hint": "\u5BF9\u8BDD\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF1B\u7559\u7A7A = \u5185\u7F6E\u4EBA\u8BBE\u3002",
  news: "\u65B0\u95FB",
  "news.hint": "\u5141\u8BB8\u5BA0\u7269\u5728\u804A\u5929\u91CC\u7528\u65B0\u9C9C\u7684 RSS/Atom \u65B0\u95FB\u56DE\u7B54\u3002",
  newsMaxItems: "\u65B0\u95FB\u6761\u6570",
  "newsMaxItems.hint": "\u6BCF\u6B21\u53D6\u51E0\u6761\u5934\u6761\uFF081\u201310\uFF09\u3002",
  newsFeeds: "\u65B0\u95FB\u6E90",
  "newsFeeds.hint": "\u6BCF\u884C\u4E00\u4E2A RSS/Atom \u5730\u5740\uFF1B\u7A7A\u884C\u5FFD\u7565\u3002"
};
var en = {
  "chatModel": "Chat model",
  "chatModel.hint": "Model for pet replies; empty uses the DSH default.",
  "chatModelDefault": "DSH default",
  "news": "News",
  "news.hint": "Fetch RSS/Atom headlines when asked.",
  "newsMaxItems": "Headline count",
  "newsMaxItems.hint": "Headlines to include in a reply (1\u201310).",
  "newsFeeds": "News feeds",
  "newsFeeds.hint": "RSS/Atom URLs, one per line.",
  voiceBrowserOption: "System voice",
  voiceApiOption: "OpenAI API (billed separately)",
  voiceSubscriptionOption: "ChatGPT subscription: audio unavailable",
  description: "Size, opacity, wandering, session memory and reply copy \u2014 applied live",
  writeFailed: "The deployment did not accept that change; the current value was read back.",
  readOnly: "This deployment is read-only.",
  update: "Update",
  check: "Check for Updates\u2026",
  checking: "Checking\u2026",
  latest: "Up to date",
  latestAt: "Up to date (currently {current})",
  updateTo: "Update to {target}\u2026",
  updateToRef: "Track {ref}\u2026",
  availableLocal: "New version {target} (currently {current}); updating switches to {ref}",
  checkRateLimited: "Upstream request is rate limited (GitHub); try again later.",
  updateFailedEnabled: "Update failed: the enabled state could not be read, so nothing changed.",
  updateFailedSource: "Update failed: this install source is not recognised.",
  updateFailedTracking: "Update failed; try again later. The profile is now pinned to {spec} \u2014 switch it back to a branch to keep tracking.",
  updating: "Updating\u2026",
  updated: "Updated.",
  updatedRestart: "Updated; the change takes effect on next start.",
  updatedOverridden: "Updated, but a higher-priority configuration overrides it for now.",
  updateFailed: "Update failed; try again later.",
  updateFailedDetail: "Update failed; try again later. ({reason})",
  checkFailed: "Could not run the check; try again later.",
  reasonSeparator: ": ",
  updateUnsupported: "In-app update is unavailable on this deployment.",
  updateUnknown: "Could not reach the source.",
  hostOutdated: "This host is too old to check for updates (upgrade DSH).",
  localSource: "Installed from a local path; update check unavailable.",
  available: "New version {target}",
  availableAt: "New version {target} (currently {current})",
  availableUnsupported: "New version {target}, but this deployment cannot update plugins.",
  enabled: "Show on page",
  "enabled.hint": "Off hides the in-page pet (e.g. while a desktop companion runs).",
  sessionMemory: "Session memory",
  "sessionMemory.hint": "The pet writes milestones such as completed tasks to the local data/whale-girl/sessions.json (a few bytes each) and reads them back along the session lineage when a session resumes or forks, greeting you with what you finished last time.\nLocal file only: never sent to the model context, never uploaded; turning it off stops all reads and writes (the file stays on this machine and can be deleted).",
  size: "Size",
  "size.hint": "Pet render size (64\u2013160 px).",
  opacity: "Opacity",
  "opacity.hint": "Default opacity (0.2\u20131).",
  walk: "Wander",
  "walk.hint": "Off stops the pet wandering.",
  sleep: "Sleep delay",
  "sleep.hint": "Idle time before sleeping (ms).",
  feed: "Feed replies",
  "feed.hint": "One per line, empty lines ignored; empty falls back to built-in copy.",
  play: "Play replies",
  "play.hint": "One per line, empty lines ignored; empty falls back to built-in copy.",
  idle: "Chit-chat",
  "idle.hint": "One per line, empty lines ignored; empty falls back to built-in copy. Spoken at random while idle.",
  voice: "Voice",
  "voice.hint": "Speak answers out loud.",
  voiceProvider: "Voice engine",
  "voiceProvider.hint": "browser = system speech; openai = a TTS model via /audio/speech.",
  voiceSttModel: "Speech-to-text model",
  "voiceSttModel.hint": "Model used for the microphone (default gpt-transcribe), via /audio/transcriptions.",
  voiceBaseUrl: "TTS endpoint",
  "voiceBaseUrl.hint": "For example https://api.openai.com/v1 or http://localhost:8880/v1.",
  voiceModel: "TTS model",
  "voiceModel.hint": "For example tts-1 / gpt-4o-mini-tts / a local model.",
  voiceName: "Voice",
  "voiceName.hint": "Voice name/ID; empty = auto (Russian voice for browser).",
  voiceApiKeyEnv: "Key variable",
  "voiceApiKeyEnv.hint": "Name of the environment variable holding the TTS key; empty = no auth.",
  voiceRate: "Speech rate",
  "voiceRate.hint": "0.5\u20132 (system voice).",
  voiceAutoSpeak: "Read long answers",
  "voiceAutoSpeak.hint": "Read only long chat answers aloud; short replies and event lines stay silent. Off by default.",
  voiceMinSpeakChars: "Reading threshold",
  "voiceMinSpeakChars.hint": "Minimum reply length to read aloud (0 = any non-empty reply).",
  voiceConversation: "Conversation mode",
  "voiceConversation.hint": "Keep listening after each answer instead of pressing the mic again.",
  chat: "Chat",
  "chat.hint": "Show the chat button and let you talk to the pet.",
  chatPersona: "Persona",
  "chatPersona.hint": "System prompt for the chat; empty = built-in persona."
};
var ru = {
  "chatModel": "\u041C\u043E\u0434\u0435\u043B\u044C \u0431\u0435\u0441\u0435\u0434\u044B",
  "chatModel.hint": "\u041C\u043E\u0434\u0435\u043B\u044C \u0434\u043B\u044F \u043E\u0442\u0432\u0435\u0442\u043E\u0432 \u043F\u0438\u0442\u043E\u043C\u0446\u0430; \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u043C\u043E\u0434\u0435\u043B\u044C DSH.",
  "chatModelDefault": "\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E DSH",
  "news": "\u041D\u043E\u0432\u043E\u0441\u0442\u0438",
  "news.hint": "\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u043F\u0438\u0442\u043E\u043C\u0446\u0443 \u0447\u0438\u0442\u0430\u0442\u044C RSS/Atom \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443.",
  "newsMaxItems": "\u0427\u0438\u0441\u043B\u043E \u043D\u043E\u0432\u043E\u0441\u0442\u0435\u0439",
  "newsMaxItems.hint": "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u043E\u0432 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0432 \u043E\u0442\u0432\u0435\u0442\u0435 (1\u201310).",
  "newsFeeds": "\u041B\u0435\u043D\u0442\u044B \u043D\u043E\u0432\u043E\u0441\u0442\u0435\u0439",
  "newsFeeds.hint": "\u0410\u0434\u0440\u0435\u0441\u0430 RSS/Atom, \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443.",
  voiceBrowserOption: "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0433\u043E\u043B\u043E\u0441",
  voiceApiOption: "OpenAI API (\u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u043E\u043F\u043B\u0430\u0442\u0430)",
  voiceSubscriptionOption: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 ChatGPT \u2014 \u0430\u0443\u0434\u0438\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E",
  description: "\u0420\u0430\u0437\u043C\u0435\u0440, \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C, \u043F\u0440\u043E\u0433\u0443\u043B\u043A\u0438, \u043F\u0430\u043C\u044F\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u0439 \u0438 \u0444\u0440\u0430\u0437\u044B \u2014 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0441\u0440\u0430\u0437\u0443",
  writeFailed: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043D\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u043E; \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E \u0442\u0435\u043A\u0443\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435.",
  readOnly: "\u042D\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F.",
  update: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435",
  check: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F\u2026",
  checking: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430\u2026",
  latest: "\u0410\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F",
  latestAt: "\u0410\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F (\u0441\u0435\u0439\u0447\u0430\u0441 {current})",
  updateTo: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0434\u043E {target}\u2026",
  updateToRef: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043D\u0430 {ref}\u2026",
  availableLocal: "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F {target} (\u0441\u0435\u0439\u0447\u0430\u0441 {current}); \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442 \u043D\u0430 {ref}",
  checkRateLimited: "\u0417\u0430\u043F\u0440\u043E\u0441 \u043A \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0443 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D (GitHub); \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.",
  updateFailedEnabled: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F, \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u043E.",
  updateFailedSource: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C: \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D.",
  updateFailedTracking: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C; \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435. \u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D \u043D\u0430 {spec} \u2014 \u0447\u0442\u043E\u0431\u044B \u0441\u043D\u043E\u0432\u0430 \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0442\u044C \u0432\u0435\u0442\u043A\u0443, \u0432\u0435\u0440\u043D\u0438\u0442\u0435 \u0435\u0451 \u0432\u0440\u0443\u0447\u043D\u0443\u044E.",
  updating: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u2026",
  updated: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E.",
  updatedRestart: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E; \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432\u0441\u0442\u0443\u043F\u044F\u0442 \u0432 \u0441\u0438\u043B\u0443 \u043F\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C \u0437\u0430\u043F\u0443\u0441\u043A\u0435.",
  updatedOverridden: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u043D\u043E \u0441\u0435\u0439\u0447\u0430\u0441 \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u043E \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0435\u0439 \u0441 \u0431\u043E\u043B\u0435\u0435 \u0432\u044B\u0441\u043E\u043A\u0438\u043C \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043E\u043C.",
  updateFailed: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C; \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.",
  updateFailedDetail: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C; \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435. ({reason})",
  checkFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C; \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.",
  reasonSeparator: ": ",
  updateUnsupported: "\u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u043E\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0432 \u044D\u0442\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435.",
  updateUnknown: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0431 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0435.",
  hostOutdated: "\u0412\u0435\u0440\u0441\u0438\u044F \u0445\u043E\u0441\u0442\u0430 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0441\u0442\u0430\u0440\u0430 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 (\u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 DSH).",
  localSource: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0438\u0437 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u0443\u0442\u0438; \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430.",
  available: "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F {target}",
  availableAt: "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F {target} (\u0441\u0435\u0439\u0447\u0430\u0441 {current})",
  availableUnsupported: "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F {target}, \u043D\u043E \u044D\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0435 \u0443\u043C\u0435\u0435\u0442 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0442\u044C \u043F\u043B\u0430\u0433\u0438\u043D\u044B.",
  enabled: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435",
  "enabled.hint": "\u0412\u044B\u043A\u043B. \u0441\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u043F\u0438\u0442\u043E\u043C\u0446\u0430 \u0432 \u0432\u0435\u0431-\u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u043F\u043E\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043D\u0430\u0441\u0442\u043E\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u043C\u043F\u0430\u043D\u044C\u043E\u043D).",
  sessionMemory: "\u041F\u0430\u043C\u044F\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u0439",
  "sessionMemory.hint": "\u041F\u0438\u0442\u043E\u043C\u0435\u0446 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0432\u0435\u0445\u0438 (\u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438) \u0432 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 data/whale-girl/sessions.json (\u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0431\u0430\u0439\u0442 \u043D\u0430 \u0437\u0430\u043F\u0438\u0441\u044C) \u0438 \u043F\u0440\u0438 \u0432\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0438 \u0438\u043B\u0438 \u0444\u043E\u0440\u043A\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 \u0447\u0438\u0442\u0430\u0435\u0442 \u0438\u0445 \u043F\u043E \u0446\u0435\u043F\u043E\u0447\u043A\u0435 \u0441\u0435\u0441\u0441\u0438\u0439, \u043F\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044F \u0432\u0430\u0441 \u0442\u0435\u043C, \u0447\u0442\u043E \u0431\u044B\u043B\u043E \u0441\u0434\u0435\u043B\u0430\u043D\u043E \u0432 \u043F\u0440\u043E\u0448\u043B\u044B\u0439 \u0440\u0430\u0437.\n\u0422\u043E\u043B\u044C\u043A\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0444\u0430\u0439\u043B: \u043D\u0435 \u043F\u043E\u043F\u0430\u0434\u0430\u0435\u0442 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0432 \u0441\u0435\u0442\u044C; \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 \u0447\u0442\u0435\u043D\u0438\u0435 \u0438 \u0437\u0430\u043F\u0438\u0441\u044C (\u0444\u0430\u0439\u043B \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043D\u0430 \u043C\u0430\u0448\u0438\u043D\u0435, \u0435\u0433\u043E \u043C\u043E\u0436\u043D\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C).",
  size: "\u0420\u0430\u0437\u043C\u0435\u0440",
  "size.hint": "\u0420\u0430\u0437\u043C\u0435\u0440 \u043F\u0438\u0442\u043E\u043C\u0446\u0430 \u0432 \u043F\u0438\u043A\u0441\u0435\u043B\u044F\u0445 (64\u2013160).",
  opacity: "\u041F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C",
  "opacity.hint": "\u041E\u0431\u044B\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C (0.2\u20131).",
  walk: "\u041F\u0440\u043E\u0433\u0443\u043B\u043A\u0438",
  "walk.hint": "\u0412\u044B\u043A\u043B. \u2014 \u043F\u0438\u0442\u043E\u043C\u0435\u0446 \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u0451\u0442 \u0433\u0443\u043B\u044F\u0442\u044C.",
  sleep: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u0441\u043D\u0430",
  "sleep.hint": "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0441\u0442\u043E\u044F \u0434\u043E \u0441\u043D\u0430 (\u043C\u0441).",
  feed: "\u0424\u0440\u0430\u0437\u044B \u043D\u0430 \u043A\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435",
  "feed.hint": "\u041F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443; \u043F\u0443\u0441\u0442\u044B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u044E\u0442\u0441\u044F; \u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0444\u0440\u0430\u0437\u044B.",
  play: "\u0424\u0440\u0430\u0437\u044B \u043D\u0430 \u0438\u0433\u0440\u0443",
  "play.hint": "\u041F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443; \u043F\u0443\u0441\u0442\u044B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u044E\u0442\u0441\u044F; \u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0444\u0440\u0430\u0437\u044B.",
  idle: "\u0411\u043E\u043B\u0442\u043E\u0432\u043D\u044F",
  "idle.hint": "\u041F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443; \u043F\u0443\u0441\u0442\u044B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u044E\u0442\u0441\u044F; \u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0444\u0440\u0430\u0437\u044B. \u041F\u0438\u0442\u043E\u043C\u0435\u0446 \u0433\u043E\u0432\u043E\u0440\u0438\u0442 \u0438\u0445 \u0441\u0430\u043C, \u043A\u043E\u0433\u0434\u0430 \u0441\u043A\u0443\u0447\u0430\u0435\u0442.",
  voice: "\u0413\u043E\u043B\u043E\u0441",
  "voice.hint": "\u041E\u0437\u0432\u0443\u0447\u0438\u0432\u0430\u0442\u044C \u043E\u0442\u0432\u0435\u0442\u044B \u0432\u0441\u043B\u0443\u0445.",
  voiceProvider: "\u0414\u0432\u0438\u0436\u043E\u043A \u0433\u043E\u043B\u043E\u0441\u0430",
  "voiceProvider.hint": "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0433\u043E\u043B\u043E\u0441 \u0438\u043B\u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0439 OpenAI API. \u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 ChatGPT \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0439 API.",
  voiceSttModel: "\u041C\u043E\u0434\u0435\u043B\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u044F",
  "voiceSttModel.hint": "\u041C\u043E\u0434\u0435\u043B\u044C \xAB\u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D \u2192 \u0442\u0435\u043A\u0441\u0442\xBB \u0447\u0435\u0440\u0435\u0437 /audio/transcriptions; \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E gpt-transcribe. \u0414\u043B\u044F OpenAI \u043D\u0443\u0436\u0435\u043D API-\u043A\u043B\u044E\u0447.",
  voiceBaseUrl: "\u0410\u0434\u0440\u0435\u0441 TTS",
  "voiceBaseUrl.hint": "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 https://api.openai.com/v1 \u0438\u043B\u0438 http://localhost:8880/v1.",
  voiceModel: "\u041C\u043E\u0434\u0435\u043B\u044C TTS",
  "voiceModel.hint": "Realtime: gpt-realtime-2.1-mini; \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u044B\u0439 TTS: gpt-4o-mini-tts \u0438\u043B\u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C.",
  voiceName: "\u0413\u043E\u043B\u043E\u0441",
  "voiceName.hint": "\u0418\u043C\u044F/\u0438\u0434 \u0433\u043E\u043B\u043E\u0441\u0430; \u043F\u0443\u0441\u0442\u043E \u2014 \u0430\u0432\u0442\u043E (\u0434\u043B\u044F browser \u2014 \u0440\u0443\u0441\u0441\u043A\u0438\u0439 \u0433\u043E\u043B\u043E\u0441).",
  voiceApiKeyEnv: "\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043A\u043B\u044E\u0447\u0430",
  "voiceApiKeyEnv.hint": "\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F DSH \u0441 API-\u043A\u043B\u044E\u0447\u043E\u043C \u0434\u043B\u044F TTS \u0438 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u044F. \u041F\u043E\u0434\u043F\u0438\u0441\u043E\u0447\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D \u043D\u0435 \u043F\u043E\u0434\u0445\u043E\u0434\u0438\u0442.",
  voiceRate: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0440\u0435\u0447\u0438",
  "voiceRate.hint": "0.5\u20132 (\u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0433\u043E\u043B\u043E\u0441).",
  voiceAutoSpeak: "\u0427\u0438\u0442\u0430\u0442\u044C \u0434\u043B\u0438\u043D\u043D\u044B\u0435 \u043E\u0442\u0432\u0435\u0442\u044B",
  "voiceAutoSpeak.hint": "\u041E\u0437\u0432\u0443\u0447\u0438\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u0438\u043D\u043D\u044B\u0435 \u043E\u0442\u0432\u0435\u0442\u044B \u0432 \u0431\u0435\u0441\u0435\u0434\u0435; \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u044F \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u0431\u0435\u0437 \u0433\u043E\u043B\u043E\u0441\u0430. \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E.",
  voiceMinSpeakChars: "\u041F\u043E\u0440\u043E\u0433 \u0447\u0442\u0435\u043D\u0438\u044F",
  "voiceMinSpeakChars.hint": "\u041C\u0438\u043D\u0438\u043C\u0443\u043C \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u0432 \u043E\u0442\u0432\u0435\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0437\u0430\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0433\u043E \u0432\u0441\u043B\u0443\u0445 (0 \u2014 \u043B\u044E\u0431\u043E\u0439 \u043D\u0435\u043F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442).",
  voiceConversation: "\u0420\u0435\u0436\u0438\u043C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u0430",
  "voiceConversation.hint": "\u041F\u043E\u0441\u043B\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 \u0441\u043D\u043E\u0432\u0430 \u0441\u043B\u0443\u0448\u0430\u0442\u044C \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D \u2014 \u043D\u0435 \u043D\u0443\u0436\u043D\u043E \u043A\u0430\u0436\u0434\u044B\u0439 \u0440\u0430\u0437 \u043D\u0430\u0436\u0438\u043C\u0430\u0442\u044C.",
  chat: "\u0411\u0435\u0441\u0435\u0434\u0430",
  "chat.hint": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043A\u043D\u043E\u043F\u043A\u0443 \xAB\u041F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C\xBB \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u0431\u0435\u0441\u0435\u0434\u0443 \u0441 \u043F\u0438\u0442\u043E\u043C\u0446\u0435\u043C.",
  chatPersona: "\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440",
  "chatPersona.hint": "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u043F\u0440\u043E\u043C\u043F\u0442 \u0431\u0435\u0441\u0435\u0434\u044B; \u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440."
};
var el = import_react.default.createElement;
function NumberField({ value, min, max, disabled, label, onChange, resetToken }) {
  const initial = value === void 0 || value === null ? "" : String(value);
  const [text, setText] = import_react.default.useState(initial);
  const [lastKey, setLastKey] = import_react.default.useState(initial);
  const [lastReset, setLastReset] = import_react.default.useState(resetToken);
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial);
    setLastReset(resetToken);
    setText(initial);
  }
  const commit = () => {
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(initial);
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    if (clamped !== parsed) setText(String(clamped));
  };
  return el(import_dsh_client_ui_primitives.Input, {
    type: "text",
    inputMode: "numeric",
    value: text,
    disabled,
    "aria-label": label,
    onChange: (e) => {
      setText(e.currentTarget.value);
    },
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    },
    style: { width: 88, textAlign: "right" }
  });
}
function LinesField({ value, disabled, label, onChange, resetToken }) {
  const initial = serializeLines(value);
  const [text, setText] = import_react.default.useState(initial);
  const [lastKey, setLastKey] = import_react.default.useState(initial);
  const [lastReset, setLastReset] = import_react.default.useState(resetToken);
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial);
    setLastReset(resetToken);
    setText(initial);
  }
  return el("textarea", {
    rows: 3,
    value: text,
    disabled,
    "aria-label": label,
    onChange: (e) => {
      setText(e.currentTarget.value);
    },
    onBlur: () => {
      onChange(parseLines(text));
    },
    style: {
      flex: "none",
      width: 240,
      padding: "6px 8px",
      resize: "vertical",
      border: "0.5px solid var(--dsw-alias-border-l4)",
      borderRadius: "var(--dsw-radius-md)",
      background: "var(--dsw-alias-bg-layer-1)",
      color: "var(--dsw-alias-label-primary)",
      font: "inherit",
      fontSize: 14,
      lineHeight: 1.5,
      boxSizing: "border-box",
      opacity: disabled ? 0.4 : 1
    }
  });
}
function TextField({ value, disabled, label, onChange, resetToken }) {
  const initial = typeof value === "string" ? value : "";
  const [text, setText] = import_react.default.useState(initial);
  const [lastKey, setLastKey] = import_react.default.useState(initial);
  const [lastReset, setLastReset] = import_react.default.useState(resetToken);
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial);
    setLastReset(resetToken);
    setText(initial);
  }
  const commit = () => {
    const next = text.trim();
    if (next !== initial) onChange(next);
  };
  return el(import_dsh_client_ui_primitives.Input, {
    type: "text",
    value: text,
    disabled,
    "aria-label": label,
    onChange: (e) => {
      setText(e.currentTarget.value);
    },
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    },
    style: { width: 220 }
  });
}
function MultilineField({ value, disabled, label, onChange, resetToken }) {
  const initial = typeof value === "string" ? value : "";
  const [text, setText] = import_react.default.useState(initial);
  const [lastKey, setLastKey] = import_react.default.useState(initial);
  const [lastReset, setLastReset] = import_react.default.useState(resetToken);
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial);
    setLastReset(resetToken);
    setText(initial);
  }
  return el("textarea", {
    rows: 3,
    value: text,
    disabled,
    "aria-label": label,
    onChange: (e) => {
      setText(e.currentTarget.value);
    },
    onBlur: () => {
      if (text.trim() !== initial) onChange(text.trim());
    },
    style: {
      flex: "none",
      width: 240,
      padding: "6px 8px",
      resize: "vertical",
      border: "0.5px solid var(--dsw-alias-border-l4)",
      borderRadius: "var(--dsw-radius-md)",
      background: "var(--dsw-alias-bg-layer-1)",
      color: "var(--dsw-alias-label-primary)",
      font: "inherit",
      fontSize: 14,
      lineHeight: 1.5,
      boxSizing: "border-box",
      opacity: disabled ? 0.4 : 1
    }
  });
}
function UpdateRow({ t }) {
  const [row, setRow] = import_react.default.useState(ROW_INITIAL);
  const dispatch = (event) => {
    setRow((state) => reduceRow(state, event));
  };
  const labelId = import_react.default.useId();
  const statusId = import_react.default.useId();
  const load = import_react.default.useCallback(async () => {
    setRow((state) => reduceRow(state, { type: "check-started" }));
    try {
      const response = await fetch(UPDATE_PATH, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const info = await response.json();
      setRow((state) => reduceRow(state, { type: "checked", info }));
    } catch {
      setRow((state) => reduceRow(state, { type: "check-failed" }));
    }
  }, []);
  import_react.default.useEffect(() => {
    void load();
  }, [load]);
  const run = async () => {
    dispatch({ type: "update-started" });
    try {
      const response = await fetch(UPDATE_PATH, { method: "POST", headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => void 0);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      dispatch({ type: "settled", ...outcomeOf(payload, t) });
    } catch {
      dispatch({ type: "settled", phase: "ready", notice: t("updateFailed"), tone: "error" });
    }
  };
  const { status, tone, action } = deriveUpdateRow({ ...row, translate: t, onCheck: load, onUpdate: run });
  return el(
    "div",
    {
      "data-whale-girl-update": "",
      role: "group",
      "aria-labelledby": labelId,
      "aria-describedby": statusId,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        borderBottom: "0.5px solid var(--dsw-alias-border-l2)"
      }
    },
    el(
      "div",
      { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 } },
      el("span", { id: labelId, style: { fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: "var(--dsw-alias-label-primary)" } }, t("update")),
      el("span", {
        id: statusId,
        role: "status",
        style: {
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: "pre-line",
          color: tone === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-label-tertiary)"
        }
      }, status)
    ),
    el(
      "span",
      { style: { flex: "none", display: "flex", alignItems: "center", gap: 8 } },
      el(import_dsh_client_ui_primitives.Button, {
        variant: action.primary === true ? "primary" : "outline",
        size: "sm",
        disabled: action.disabled,
        "aria-describedby": statusId,
        onClick: () => {
          void action.run();
        }
      }, action.label)
    )
  );
}
function SelectField({ value, options, disabled, label, onChange, t }) {
  const current = typeof value === "string" ? value : "";
  return el("select", {
    value: current,
    disabled,
    "aria-label": label,
    onChange: (event) => onChange(event.currentTarget.value),
    style: {
      width: 220,
      padding: "6px 8px",
      fontSize: 14,
      font: "inherit",
      border: "0.5px solid var(--dsw-alias-border-l4)",
      borderRadius: "var(--dsw-radius-md)",
      background: "var(--dsw-alias-bg-layer-1)",
      color: "var(--dsw-alias-label-primary)",
      boxSizing: "border-box",
      opacity: disabled ? 0.4 : 1
    }
  }, (Array.isArray(options) ? options : []).map((option) => el("option", {
    key: option,
    value: option
  }, option === "openai" ? t("voiceApiOption") : option === "subscription" ? t("voiceSubscriptionOption") : option === "browser" ? t("voiceBrowserOption") : option)));
}
function ModelField({ value, disabled, label, hintDefault, resetToken, onSelect, onWritePair }) {
  const [options, setOptions] = import_react.default.useState(null);
  const [failed, setFailed] = import_react.default.useState(false);
  import_react.default.useEffect(() => {
    let alive = true;
    fetch(MODELS_PATH, { headers: { accept: "application/json" } }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }).then((body) => {
      if (!alive) return;
      const list = Array.isArray(body?.options) ? body.options : [];
      setOptions(list.filter((option) => option !== null && typeof option === "object" && typeof option.provider === "string" && typeof option.model === "string"));
      setFailed(false);
    }).catch(() => {
      if (alive) {
        setOptions([]);
        setFailed(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  const route = splitModelKey(value);
  if (failed) {
    return el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 6 } },
      el(TextField, { value: route?.provider ?? "", disabled, label: `${label}: provider`, resetToken, onChange: (text) => onWritePair("chat.provider", text) }),
      el(TextField, { value: route?.model ?? "", disabled, label: `${label}: model`, resetToken, onChange: (text) => onWritePair("chat.model", text) })
    );
  }
  const current = route === null ? "" : modelKey(route.provider, route.model);
  const known = options ?? [];
  const rows = [{ key: "", label: hintDefault }];
  if (current !== "" && !known.some((option) => modelKey(option.provider, option.model) === current)) {
    rows.push({ key: current, label: `${route?.provider} / ${route?.model}` });
  }
  for (const option of known) {
    const key = modelKey(option.provider, option.model);
    const text = typeof option.label === "string" && option.label !== "" ? option.label : `${option.provider} / ${option.model}`;
    rows.push({ key, label: text });
  }
  return el("select", {
    value: current,
    disabled: disabled || options === null,
    "aria-label": label,
    onChange: (event) => onSelect(event.currentTarget.value),
    style: {
      width: 220,
      padding: "6px 8px",
      fontSize: 14,
      font: "inherit",
      border: "0.5px solid var(--dsw-alias-border-l4)",
      borderRadius: "var(--dsw-radius-md)",
      background: "var(--dsw-alias-bg-layer-1)",
      color: "var(--dsw-alias-label-primary)",
      boxSizing: "border-box",
      opacity: disabled || options === null ? 0.4 : 1
    }
  }, rows.map((row) => el("option", { key: row.key === "" ? "__default" : row.key, value: row.key }, row.label)));
}
function WhaleSettingsCard(props) {
  const state = props.useWhaleSettings((s) => s);
  const [failed, setFailed] = import_react.default.useState(false);
  const [resetToken, setResetToken] = import_react.default.useState(0);
  const t = props.t;
  if (props.view === "summary") return t("description");
  if (!state.available) return null;
  const disabled = !state.writable;
  const commit = (def, value) => {
    setFailed(false);
    Promise.resolve(props.write(def.path, value)).catch(() => {
      setFailed(true);
      setResetToken((n) => n + 1);
    });
  };
  const commitPaths = (pairs) => {
    setFailed(false);
    Promise.resolve(props.writeMany(pairs)).catch(() => {
      setFailed(true);
      setResetToken((n) => n + 1);
    });
  };
  const commitRoute = (key) => {
    const route = splitModelKey(key);
    commitPaths(route === null ? [["chat.provider", ""], ["chat.model", ""]] : [["chat.provider", route.provider], ["chat.model", route.model]]);
  };
  const row = (def, index) => {
    const control = def.kind === "toggle" ? el(import_dsh_client_ui_primitives.Switch, { checked: state.fields[def.path] === true, disabled, label: t(def.labelKey), onChange: (checked) => {
      commit(def, checked);
    } }) : def.kind === "number" ? el(NumberField, { value: state.fields[def.path], min: def.min, max: def.max, step: def.step, disabled, label: t(def.labelKey), onChange: (value) => {
      commit(def, value);
    }, resetToken }) : def.kind === "lines" ? el(LinesField, { value: state.fields[def.path], disabled, label: t(def.labelKey), onChange: (lines) => {
      commit(def, lines);
    }, resetToken }) : def.kind === "multiline" ? el(MultilineField, { value: state.fields[def.path], disabled, label: t(def.labelKey), onChange: (text) => {
      commit(def, text);
    }, resetToken }) : def.kind === "model" ? el(ModelField, {
      value: state.fields[def.path],
      disabled,
      label: t(def.labelKey),
      hintDefault: t("chatModelDefault"),
      resetToken,
      onSelect: commitRoute,
      onWritePair: (path, text) => commitPaths([[path, text]])
    }) : def.kind === "select" ? el(SelectField, { t, value: state.fields[def.path], options: def.options, disabled, label: t(def.labelKey), onChange: (value) => {
      commit(def, value);
    } }) : el(TextField, { value: state.fields[def.path], disabled, label: t(def.labelKey), onChange: (text) => {
      commit(def, text);
    }, resetToken });
    return el("div", {
      key: def.path,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        borderBottom: index < CARD_FIELDS.length - 1 ? "0.5px solid var(--dsw-alias-border-l2)" : "none"
      }
    }, el(
      "div",
      { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 } },
      el("span", { style: { fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: "var(--dsw-alias-label-primary)" } }, t(def.labelKey)),
      el("span", { style: { fontSize: 12, lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)", whiteSpace: "pre-line" } }, t(`${def.labelKey}.hint`))
    ), control);
  };
  return el(
    "div",
    {
      "data-whale-girl-settings-card": "",
      style: { display: "flex", flexDirection: "column", boxSizing: "border-box" }
    },
    disabled ? el("p", { role: "status", style: { margin: "0 0 8px", fontSize: 12, lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)" } }, t("readOnly")) : null,
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 0 } },
      el(UpdateRow, { key: "update", t }),
      CARD_FIELDS.map((def, index) => row(def, index))
    ),
    failed ? el("p", { role: "status", style: { margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--dsw-alias-state-error-primary)" } }, t("writeFailed")) : null
  );
}
function registerWhaleSettingsCard(ctx, namespace, defaults) {
  const scope = ctx.configForms.get(namespace);
  const offLocale = ctx.locale.register(SETTINGS_NS, { zh, en, ru });
  let cache2;
  const getSnapshot = () => {
    const snap = scope.getSnapshot();
    if (cache2 !== void 0 && cache2.snap === snap) return cache2.state;
    cache2 = { snap, state: deriveState(snap, defaults) };
    return cache2.state;
  };
  const offServed = ctx.configForms.whileServed([namespace], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: namespace,
    // Keyed slot: the key must match the bundle package name to render on its package page.
    locale: SETTINGS_NS,
    inject: () => ({
      hooks: { whaleSettings: { getSnapshot, subscribe: (listener) => scope.subscribe(listener) } },
      write: (path, value) => writeField(scope, path, value),
      writeMany: (pairs) => writeFields(scope, pairs)
    })
  }, WhaleSettingsCard)));
  return () => {
    offServed();
    offLocale();
  };
}

// src/client/microphone.ts
function createMicrophoneCapture(options) {
  let generation = 0;
  let pending = false;
  let active = null;
  const tracksOff = (stream) => {
    for (const track of stream.getTracks()) track.stop();
  };
  const stop2 = (submit = true) => {
    const capture = active;
    if (capture === null) return;
    capture.submit = submit;
    if (capture.timer !== null) {
      clearTimeout(capture.timer);
      capture.timer = null;
    }
    if (capture.recorder.state !== "inactive") capture.recorder.stop();
  };
  const cancel2 = () => {
    generation += 1;
    pending = false;
    const capture = active;
    if (capture !== null) {
      capture.submit = false;
      tracksOff(capture.stream);
      stop2(false);
      active = null;
    }
    options.recording(false);
  };
  const start = async () => {
    if (pending || active !== null || !options.allowed()) return;
    const token = ++generation;
    pending = true;
    let stream = null;
    try {
      stream = await options.acquire();
      if (token !== generation || !options.allowed()) {
        tracksOff(stream);
        return;
      }
      const recorder = options.create(stream);
      const capture = { recorder, stream, submit: false, timer: null };
      const chunks = [];
      active = capture;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        tracksOff(capture.stream);
        if (capture.timer !== null) clearTimeout(capture.timer);
        if (active === capture) {
          active = null;
          options.recording(false);
        }
        if (!capture.submit || token !== generation || !options.allowed()) return;
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mime });
        if (blob.size > 0) options.audio(blob, mime);
      };
      recorder.onerror = () => {
        if (token !== generation) return;
        cancel2();
        options.error(new Error("audio-capture"));
      };
      recorder.start();
      options.recording(true);
      capture.timer = setTimeout(() => stop2(true), 3e4);
    } catch (error) {
      if (stream !== null) tracksOff(stream);
      if (token === generation) {
        cancel2();
        options.error(error);
      }
    } finally {
      if (token === generation) pending = false;
    }
  };
  return { start, stop: stop2, cancel: cancel2, busy: () => pending || active !== null };
}
function createConversationResume(allowed, listen, delayMs = 250) {
  let timer = null;
  let generation = 0;
  const cancel2 = () => {
    generation += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    cancel2();
    if (!allowed()) return;
    const token = generation;
    timer = setTimeout(() => {
      timer = null;
      if (token === generation && allowed()) listen();
    }, delayMs);
  };
  return { cancel: cancel2, schedule };
}
function createSpeechRequest() {
  let active = null;
  const cancel2 = () => {
    active?.abort();
    active = null;
  };
  const start = () => {
    cancel2();
    active = new AbortController();
    return active.signal;
  };
  const current = (signal) => active?.signal === signal && !signal.aborted;
  return { start, cancel: cancel2, current };
}

// src/client/overlay-placement.ts
function planOverlay({ rect, viewport, size, above, offsetY = 0, margin = 8 }) {
  const roomAbove = rect.top - margin - offsetY;
  const roomBelow = viewport.h - rect.bottom - margin - offsetY;
  let up = above;
  if (above && roomAbove < size.h && roomBelow > roomAbove) up = false;
  else if (!above && roomBelow < size.h && roomAbove > roomBelow) up = true;
  const centerX = rect.left + rect.width / 2;
  let dx = 0;
  if (size.w >= viewport.w - margin * 2) dx = viewport.w / 2 - centerX;
  else if (centerX - size.w / 2 < margin) dx = margin - centerX + size.w / 2;
  else if (centerX + size.w / 2 > viewport.w - margin) dx = viewport.w - margin - centerX - size.w / 2;
  const shift = Math.round(dx);
  return {
    up,
    // Expose numeric placement too: the style strings below apply only inside the host (absolute
    // position, left:50%). A fixed chat input on body uses viewport coordinates, so return shift/up
    // and let the caller calculate top/left from getBoundingClientRect.
    shift,
    top: up ? `-${offsetY}px` : `calc(100% + ${offsetY}px)`,
    transform: up ? "translate(-50%, -100%)" : "translateX(-50%)",
    left: shift === 0 ? "50%" : `calc(50% ${shift > 0 ? "+" : "-"} ${Math.abs(shift)}px)`
  };
}

// src/client/menu.ts
function menuFocusIndex(key, current, count) {
  if (count === 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return (current + 1 + count) % count;
  if (key === "ArrowUp") return current <= 0 ? count - 1 : current - 1;
  return -1;
}
function currentSessionId(snapshot) {
  if (snapshot?.byId === null || typeof snapshot?.byId !== "object") return void 0;
  const selected = Object.entries(snapshot.byId).filter(([, row]) => typeof row?.retainedBy?.mainView === "number" && row.retainedBy.mainView > 0).map(([id]) => id);
  return selected.length === 1 ? selected[0] : void 0;
}
var SESSION_STATUS_QUESTION = "\u041A\u0430\u043A \u0434\u0435\u043B\u0430? \u0420\u0430\u0441\u0441\u043A\u0430\u0436\u0438, \u0447\u0442\u043E \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0441\u0435\u0441\u0441\u0438\u0438: \u043D\u0430\u0434 \u0447\u0435\u043C \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u043C, \u0447\u0442\u043E \u0443\u0436\u0435 \u0441\u0434\u0435\u043B\u0430\u043D\u043E \u0438 \u0447\u0442\u043E \u0435\u0449\u0451 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C. \u0415\u0441\u043B\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435\u0442, \u0441\u043A\u0430\u0436\u0438 \u043E\u0431 \u044D\u0442\u043E\u043C.";
function bindMenuKeyboard(menu, close) {
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    const items = [...menu.querySelectorAll("button")].filter((item) => !item.disabled && item.style.display !== "none");
    const next = menuFocusIndex(event.key, items.indexOf(menu.ownerDocument.activeElement), items.length);
    if (next < 0) return;
    event.preventDefault();
    items[next]?.focus();
  };
  menu.addEventListener("keydown", onKeyDown);
  return () => menu.removeEventListener("keydown", onKeyDown);
}

// src/client/chat-reply.ts
function replyWaitingPhase(textPending, voicePending, speaking) {
  return textPending ? "thinking" : voicePending && !speaking ? "voice" : null;
}
async function presentChatReply(options) {
  if (!options.current()) return;
  options.speak();
  await options.reveal();
  if (options.current()) options.finish();
}

// src/client/pcm-playback.ts
var PCM_RATE = 24e3;
var PCM_MAX_BYTES = 8 * 1024 * 1024;
function validPcmType(raw) {
  const [type, ...fields] = (raw ?? "").toLowerCase().split(";").map((value) => value.trim());
  const parameters = /* @__PURE__ */ new Map();
  for (const field of fields) {
    const [key, value] = field.split("=").map((part) => part.trim());
    if (key !== void 0 && value !== void 0) parameters.set(key, value);
  }
  return type === "audio/pcm" && parameters.get("rate") === "24000" && parameters.get("channels") === "1" && parameters.get("encoding") === "s16le";
}
async function playPcmResponse(response, options) {
  const { signal } = options;
  const aborted = () => new DOMException("Speech playback cancelled", "AbortError");
  if (signal.aborted) throw aborted();
  if (!response.ok || !validPcmType(response.headers.get("content-type"))) throw new Error("tts-invalid-content-type");
  const reader = response.body?.getReader();
  if (reader === void 0) throw new Error("tts-empty");
  const sources = /* @__PURE__ */ new Set();
  let context = null;
  let stopped = false;
  let inputDone = false;
  let playing = false;
  let finishPlayback = () => {
  };
  const playbackDone = new Promise((resolve) => {
    finishPlayback = resolve;
  });
  let interrupt = () => {
  };
  const interrupted = new Promise((_resolve, reject) => {
    interrupt = reject;
  });
  void interrupted.catch(() => {
  });
  const cancelReader = () => {
    void reader.cancel().catch(() => {
    });
  };
  const stopSources = () => {
    for (const source of sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
      }
      try {
        source.disconnect();
      } catch {
      }
    }
    sources.clear();
  };
  const onAbort = () => {
    stopped = true;
    stopSources();
    cancelReader();
    interrupt(aborted());
  };
  signal.addEventListener("abort", onAbort, { once: true });
  let resumeTimer = null;
  try {
    try {
      context = (options.contextFactory ?? (() => new AudioContext()))();
      const resumeTimeout = new Promise((_resolve, reject) => {
        resumeTimer = setTimeout(() => reject(new Error("tts-playback-blocked")), 5e3);
      });
      await Promise.race([context.resume(), interrupted, resumeTimeout]);
      if (signal.aborted || stopped) throw aborted();
      if (context.state !== "running") throw new Error("tts-playback-blocked");
    } catch (error) {
      if (signal.aborted) throw aborted();
      throw new Error("tts-playback-blocked", { cause: error });
    } finally {
      if (resumeTimer !== null) clearTimeout(resumeTimer);
    }
    let nextStart = context.currentTime + 0.03;
    let size = 0;
    let trailingByte = null;
    for (; ; ) {
      const next = await Promise.race([reader.read(), interrupted]);
      if (signal.aborted || stopped) throw aborted();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > PCM_MAX_BYTES) throw new Error("tts-too-large");
      let bytes = next.value;
      if (trailingByte !== null) {
        const joined = new Uint8Array(bytes.byteLength + 1);
        joined[0] = trailingByte;
        joined.set(bytes, 1);
        bytes = joined;
        trailingByte = null;
      }
      const length = bytes.byteLength - bytes.byteLength % 2;
      if (length !== bytes.byteLength) trailingByte = bytes[length];
      if (length === 0) continue;
      const buffer = context.createBuffer(1, length / 2, PCM_RATE);
      const data = buffer.getChannelData(0);
      const view = new DataView(bytes.buffer, bytes.byteOffset, length);
      for (let i = 0; i < data.length; i += 1) data[i] = view.getInt16(i * 2, true) / 32768;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      sources.add(source);
      source.onended = () => {
        if (stopped) return;
        sources.delete(source);
        source.disconnect();
        if (inputDone && sources.size === 0) finishPlayback();
      };
      nextStart = Math.max(nextStart, context.currentTime + 0.03);
      source.start(nextStart);
      nextStart += buffer.duration;
      if (!playing) {
        playing = true;
        options.onPlaying();
      }
    }
    if (trailingByte !== null) throw new Error("tts-invalid-audio");
    if (size === 0) throw new Error("tts-empty");
    inputDone = true;
    if (sources.size > 0) await Promise.race([playbackDone, interrupted]);
    if (signal.aborted || stopped) throw aborted();
  } catch (error) {
    stopped = true;
    stopSources();
    cancelReader();
    if (signal.aborted) throw aborted();
    if (error instanceof Error && error.message.startsWith("tts-")) throw error;
    throw new Error("tts-incomplete", { cause: error });
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (resumeTimer !== null) clearTimeout(resumeTimer);
    try {
      reader.releaseLock();
    } catch {
    }
    if (context !== null) void context.close().catch(() => {
    });
  }
}

// src/core/speech-text.ts
function cleanSpeechText(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[#*0-9]\uFE0F?\u20E3/gu, " ").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]/gu, " ").replace(/\u200D|\uFE0E|\uFE0F|\u20E3|[\u{E0020}-\u{E007F}]/gu, "").replace(/[«»"]/g, "").replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}
var SPEECH_CHUNK_MAX = 300;
function lastBreakEnd(window2, pattern) {
  let end = 0;
  for (const match of window2.matchAll(pattern)) end = (match.index ?? 0) + match[0].length;
  return end;
}
function splitSpeechChunks(raw, max = SPEECH_CHUNK_MAX) {
  const restText = cleanSpeechText(raw);
  if (restText === "") return [];
  const limit = Number.isFinite(max) ? Math.max(1, Math.floor(Number(max))) : SPEECH_CHUNK_MAX;
  const chunks = [];
  let rest = restText;
  while (rest !== "") {
    const chars = Array.from(rest);
    if (chars.length <= limit) {
      chunks.push(rest);
      break;
    }
    const window2 = chars.slice(0, limit).join("");
    const cut = lastBreakEnd(window2, /[.!?…]["»']?\s/g) || lastBreakEnd(window2, /[,;:]\s/g) || lastBreakEnd(window2, /[—–-]\s/g) || lastBreakEnd(window2, /\s/g) || window2.length;
    const piece = window2.slice(0, cut).trim();
    if (piece !== "") chunks.push(piece);
    rest = rest.slice(cut).trimStart();
  }
  return chunks;
}
function shouldSpeakReply(text, voice) {
  if (voice === null || typeof voice !== "object") return false;
  if (voice.enabled !== true || voice.autoSpeakChat !== true) return false;
  if (typeof voice.minSpeakChars !== "number" || !Number.isFinite(voice.minSpeakChars)) return false;
  const clean = cleanSpeechText(text);
  if (clean === "") return false;
  const minimum = Math.max(0, Math.floor(voice.minSpeakChars));
  return minimum === 0 || Array.from(clean).length >= minimum;
}
function speechTone(text) {
  if (/не (?:удалось|получилось)|ошибк|сбой|расстро/i.test(text)) return "calm";
  if (/ура|побед|справились|отличн|!/i.test(text)) return "cheerful";
  if (text.includes("?")) return "curious";
  if (/код|тест|AI|программ|граничн|отлад/i.test(text)) return "focused";
  return "warm";
}

// src/core/voice.ts
var VOICE_TEXT_MAX = 300;
var TTS_MAX_BYTES = 8 * 1024 * 1024;
var STT_MAX_BYTES = 5 * 1024 * 1024;

// src/client/index.ts
var ASSETS_URL = ASSETS_PATH;
var MANIFEST_URL = `${ASSETS_URL}/manifest.json`;
var CFG_DEFAULTS = {
  enabled: true,
  sessionMemory: false,
  size: 110,
  opacity: 1,
  walk: { enabled: true, minWaitMs: 18e3, maxWaitMs: 4e4, minMs: 3e3, maxMs: 6e3, speedPxPerSec: 45 },
  sleepAfterMs: 6e4,
  pollMs: 3e3,
  bubbleMs: 15e3,
  // Mirrors DEFAULTS (verify-config-sync): the client needs defaults before its first /config
  // response.
  voice: { enabled: false, provider: "browser", rate: 1, conversation: false, autoSpeakChat: false, minSpeakChars: 200 },
  chat: { enabled: true, sessionContext: true }
};
var SETTINGS_NAMESPACE = "whale-girl";
var cfg = { ...CFG_DEFAULTS };
var TICK_MS = 200;
var DRAG_RELEASE_MS = 1500;
var CSS = `
[data-whale-girl] { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  width: var(--pet-size, 110px); height: var(--pet-size, 110px);
  font-family: system-ui, sans-serif; user-select: none; touch-action: none;
  opacity: var(--pet-opacity, 1); }
[data-whale-girl] .pet-stage { position: relative; width: var(--pet-size, 110px); height: var(--pet-size, 110px); display: grid; place-items: center;
  font-size: calc(var(--pet-size, 110px) * 0.4); line-height: 1; text-align: center;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,.25));
  pointer-events: none; /*
   * The visual layer does not intercept input: the content-bounds hit area owns interaction;
   * transparent margins are not clickable.
   */
[data-whale-girl] .pet-effects { position: absolute; left: 0; top: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px);
  pointer-events: none; overflow: visible; z-index: 2; }
[data-whale-girl] .pet-hitarea { position: absolute; inset: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px);
  cursor: grab; touch-action: none; z-index: 3; border-radius: 8px; }
[data-whale-girl] .pet-sprite { pointer-events: none; /*
 * Visual positioning, sizing, and transforms are inline JS styles because the host may override
 * injected CSS.
 */ }
[data-whale-girl] .pet-sprite.ready { display: block; }
/*
 * The status card sits below the pet with clearance for its +/-4 px bob, and flips above near the
 * bottom edge.
 */
[data-whale-girl] .pet-status { position: absolute; left: 50%; top: calc(100% + 18px); transform: translateX(-50%);
  width: max-content; min-width: 96px; max-width: calc(100vw - 24px); padding: 5px 8px;
  background: rgba(27,30,40,.94); backdrop-filter: blur(10px) saturate(1.15);
  border: 1px solid rgba(255,255,255,.10); border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,.38), 0 3px 8px rgba(0,0,0,.28);
  color: #E8EBF2; font-size: 11px; display: grid; gap: 4px; z-index: 1;
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity .15s ease-out, transform .15s ease-out, visibility 0s linear .2s; }
[data-whale-girl] .pet-status::after { /* The tail bridges the pet/card gap so hover remains continuous without flicker. */
  content: ''; position: absolute; left: 50%; top: -5px; width: 10px; height: 10px;
  transform: translateX(-50%) rotate(45deg); background: rgba(27,30,40,.94);
  border-top: 1px solid rgba(255,255,255,.10); border-left: 1px solid rgba(255,255,255,.10);
  border-top-left-radius: 3px; pointer-events: auto; }
[data-whale-girl]:hover .pet-status,
[data-whale-girl]:focus-within .pet-status {
  opacity: 1; visibility: visible; pointer-events: auto;
  transform: translateX(-50%) translateY(0);
  transition: opacity .2s cubic-bezier(.16,1,.3,1), transform .2s cubic-bezier(.16,1,.3,1), visibility 0s;
  transition-delay: .06s; }
[data-whale-girl] .pet-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
[data-whale-girl] .pet-lv { background: rgba(86,134,254,.16); color: #B7C8FE; border-radius: 5px;
  padding: 2px 6px; font-size: 10px; font-weight: 600; line-height: 16px; white-space: nowrap; }
[data-whale-girl] .pet-stats { color: #E8EBF2; font-size: 11px; line-height: 16px;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
[data-whale-girl] .pet-note { color: #E8EBF2; font-size: 11px; line-height: 15px;
  text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
[data-whale-girl] .pet-status::after { /* The tail bridges the pet/card gap for continuous hover; main positioning is inline JS. */
  content: ''; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px;
  transform: translateX(-50%) rotate(45deg); background: rgba(24,28,38,.94);
  border-top: 1px solid rgba(255,255,255,.10); border-left: 1px solid rgba(255,255,255,.10);
  border-top-left-radius: 3px; pointer-events: auto; }
[data-whale-girl] .pet-status.pet-status-above::after { top: auto; bottom: auto; top: -5px; } /* At the bottom edge the card flips above; its tail points down toward the pet. */
[data-whale-girl] .pet-menu { display: none; position: absolute; left: 50%; top: -12px; transform: translate(-50%, -100%);
  width: max-content; gap: 6px; padding: 6px; border-radius: 8px;
  background: rgba(20,20,28,.72); }
[data-whale-girl] .pet-bubble { position: absolute; left: 50%; top: calc(100% + 12px); transform: translateX(-50%);
  background: rgba(24,28,38,.94); color: #E8EBF2; font-size: 11px; padding: 8px 10px; border-radius: 10px;
  max-width: min(280px, calc(100vw - 16px)); text-align: left; pointer-events: none;
  animation: whale-girl-pop .25s ease-out; z-index: 3; }
[data-whale-girl] .pet-menu.open { display: flex; }
[data-whale-girl] .pet-menu button { flex: 1; border: 0; border-radius: 6px; padding: 4px 8px;
  font-size: 11px; cursor: pointer; background: rgba(255,255,255,.14); color: #E8EBF2; }
[data-whale-girl] .pet-menu button:hover { background: rgba(255,255,255,.28); }
[data-whale-girl] .pet-menu button:focus-visible, [data-whale-girl] .pet-stage:focus-visible { outline: 2px solid #B7C8FE; outline-offset: 2px; }
[data-whale-girl-chat] :focus-visible { outline: 2px solid #B7C8FE !important; outline-offset: 2px; }
[data-whale-girl] .pet-heart { position: absolute; font-size: 20px; pointer-events: none;
  animation: whale-girl-float 1.8s ease-out forwards; }
/*
 * State motion recipes map manifest.motion to stage CSS classes: multi-frame sheets use the frame
 * player, single-frame sheets use these animations. Animate the stage, which has no inline
 * transform, to avoid conflicting with sprite scaling. Restrained amplitudes (+/-2-6 px/degrees)
 * and quarter-step keyframes create smooth oscillation.
 */
[data-whale-girl] .pet-stage.pet-motion-bob { animation: whale-girl-m-bob 2.4s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-wiggle { animation: whale-girl-m-wiggle .9s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-squash { animation: whale-girl-m-squash .7s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-shake { animation: whale-girl-m-shake .3s linear infinite; }
[data-whale-girl] .pet-stage.pet-motion-sigh { animation: whale-girl-m-sigh 1.6s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-hop { animation: whale-girl-m-hop .6s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-tilt { animation: whale-girl-m-tilt 1.2s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-float { animation: whale-girl-m-float 3.2s ease-in-out infinite; }
[data-whale-girl] .pet-stage.pet-motion-wave { animation: whale-girl-m-wave 1s ease-in-out infinite; }
@keyframes whale-girl-m-bob { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-3px); } 60% { transform: translateY(-4px); } }
@keyframes whale-girl-m-wiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-2deg); } 75% { transform: rotate(2deg); } }
@keyframes whale-girl-m-squash { 0%,100% { transform: scale(1,1); } 25% { transform: scale(1.06,.94); } 50% { transform: scale(.96,1.04); } 75% { transform: scale(1.03,.97); } }
@keyframes whale-girl-m-shake { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-2px); } 60% { transform: translateX(2px); } 80% { transform: translateX(-1px); } }
@keyframes whale-girl-m-sigh { 0%,100% { transform: translateY(0) scale(1,1); } 40% { transform: translateY(1.5px) scale(1,.98); } }
@keyframes whale-girl-m-hop { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } 70% { transform: translateY(0); } }
@keyframes whale-girl-m-tilt { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-4deg); } 70% { transform: rotate(4deg); } }
@keyframes whale-girl-m-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes whale-girl-m-wave { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-6deg); } 40% { transform: rotate(6deg); } 60% { transform: rotate(-4deg); } 80% { transform: rotate(4deg); } }
@keyframes whale-girl-float { 0% { opacity: 1; transform: translateY(0) scale(.7); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-72px) scale(1.25); } }
@keyframes whale-girl-pop { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }
[data-whale-girl][data-whale-girl-inert] { opacity: .6; pointer-events: none; }
[data-whale-girl] .pet-stage.pet-speaking { animation: whale-girl-m-speak .55s ease-in-out infinite; }
@keyframes whale-girl-m-speak { 0%,100% { transform: translateY(0); } 45% { transform: translateY(-2px); } 70% { transform: translateY(0); } }
[data-whale-girl][data-whale-girl-hidden] { display: none; }
[data-whale-girl] .pet-stage:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) {
  [data-whale-girl] .pet-stage { animation: none !important; }
  [data-whale-girl] .pet-sprite { animation: none !important; }
  [data-whale-girl] .pet-heart { animation: none; opacity: 0; }
  [data-whale-girl] .pet-bubble { animation: none; }
  [data-whale-girl] .pet-status { transition: none !important; }
}
`;
function apply(ctx) {
  if (document.querySelector("[data-whale-girl]") !== null) {
    console.warn("[whale-girl] apply: \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442, \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u043C\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E");
    return () => {
    };
  }
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  let offSettings = null;
  try {
    if (ctx.configForms && ctx.slots) {
      offSettings = registerWhaleSettingsCard(ctx, SETTINGS_NAMESPACE, CFG_DEFAULTS);
    }
  } catch (error) {
    console.warn("[whale-girl] \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A (\u043F\u0438\u0442\u043E\u043C\u0435\u0446 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043A\u0430\u043A \u043E\u0431\u044B\u0447\u043D\u043E):", error);
    offSettings = null;
  }
  const PANEL_THEME = {
    bg: "rgba(24, 28, 38, .94)",
    // Shared panel background for status, bubbles, and menu.
    border: "rgba(255,255,255,.10)",
    // Border color for solid panels.
    text: "#E8EBF2",
    // Primary text color.
    radius: "10px",
    // Shared corner radius.
    font: "11px",
    // Shared base font size.
    shadow: "0 12px 32px rgba(0,0,0,.38), 0 3px 8px rgba(0,0,0,.28)"
    // Overlay shadow.
  };
  const createPanel = ({ anchor = "below", variant = "plain", offsetY: offsetY2 = 12, zIndex = "3", display = "block" } = {}) => {
    const el2 = document.createElement("div");
    const pos = anchor === "above" ? `top: -${offsetY2}px; transform: translate(-50%, -100%);` : `top: calc(100% + ${offsetY2}px); transform: translateX(-50%);`;
    const surface = variant === "solid" ? `background: ${PANEL_THEME.bg}; border: 1px solid ${PANEL_THEME.border}; box-shadow: ${PANEL_THEME.shadow};` : `background: ${PANEL_THEME.bg};`;
    el2.style.cssText = [
      "position: absolute; left: 50%;",
      pos,
      "width: max-content;",
      surface,
      `color: ${PANEL_THEME.text}; font-size: ${PANEL_THEME.font};`,
      `border-radius: ${PANEL_THEME.radius}; z-index: ${zIndex};`,
      `display: ${display}; pointer-events: none;`
    ].join(" ");
    return {
      el: el2,
      show() {
        el2.style.display = display;
      },
      hide() {
        el2.style.display = "none";
      }
    };
  };
  const host = document.createElement("div");
  host.setAttribute("data-whale-girl", "");
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "\u0414\u043E\u043C\u0430\u0448\u043D\u0438\u0439 \u043F\u0438\u0442\u043E\u043C\u0435\u0446");
  host.setAttribute("aria-expanded", "false");
  host.style.cssText = `position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
    width: var(--pet-size, 110px); height: var(--pet-size, 110px);
    font-family: system-ui, sans-serif; user-select: none; touch-action: none;
    opacity: var(--pet-opacity, 1);`;
  host.style.display = "none";
  document.body.appendChild(host);
  const stage = document.createElement("div");
  stage.className = "pet-stage";
  stage.setAttribute("role", "button");
  stage.setAttribute("tabindex", "0");
  stage.setAttribute("aria-label", "\u041C\u0435\u043D\u044E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439: Enter \u0438\u043B\u0438 \u043F\u0440\u043E\u0431\u0435\u043B");
  const sprite = document.createElement("div");
  sprite.className = "pet-sprite";
  stage.appendChild(sprite);
  const status = createPanel({ anchor: "below", variant: "solid", offsetY: 18, zIndex: "1" }).el;
  status.className = "pet-status";
  status.style.backdropFilter = "blur(10px) saturate(1.15)";
  status.style.padding = "5px 8px";
  status.style.minWidth = "96px";
  status.style.maxWidth = "calc(100vw - 24px)";
  status.style.display = "grid";
  status.style.gap = "4px";
  status.style.opacity = "0";
  status.style.visibility = "hidden";
  status.style.pointerEvents = "none";
  status.style.transition = "opacity .15s ease-out, visibility 0s linear .2s";
  status.innerHTML = `
    <div class="pet-meta" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <span class="pet-lv" style="background:rgba(86,134,254,.16); color:#B7C8FE; border-radius:5px; padding:2px 6px; font-size:10px; font-weight:600; line-height:16px; white-space:nowrap;">Lv.1</span>
      <span class="pet-stats" style="color:#E8EBF2; font-size:11px; line-height:16px; font-variant-numeric:tabular-nums; white-space:nowrap;">\u0417\u0430\u0434\u0430\u0447: 0</span>
    </div>
    <div class="pet-note" style="color:#E8EBF2; font-size:11px; line-height:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">\u2026</div>`;
  const metaLv = status.querySelector(".pet-lv");
  const metaStats = status.querySelector(".pet-stats");
  const metaNote = status.querySelector(".pet-note");
  metaLv.style.cssText = "background:rgba(86,134,254,.16); color:#B7C8FE; border-radius:5px; padding:2px 6px; font-size:10px; font-weight:600; line-height:16px; white-space:nowrap;";
  metaStats.style.cssText = "color:#E8EBF2; font-size:11px; line-height:16px; font-variant-numeric:tabular-nums; white-space:nowrap;";
  metaNote.style.cssText = "color:#E8EBF2; font-size:11px; line-height:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;";
  const menu = createPanel({ anchor: "above", variant: "plain", offsetY: 12, zIndex: "4", display: "none" }).el;
  menu.className = "pet-menu";
  menu.id = "whale-girl-actions";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u0438\u0442\u043E\u043C\u0446\u0430");
  stage.setAttribute("aria-haspopup", "menu");
  stage.setAttribute("aria-controls", menu.id);
  stage.setAttribute("aria-expanded", "false");
  menu.style.flexDirection = "column";
  menu.style.width = "220px";
  menu.style.maxWidth = "calc(100vw - 16px)";
  menu.style.boxSizing = "border-box";
  menu.style.overflowY = "auto";
  menu.style.touchAction = "pan-y";
  menu.style.gap = "2px";
  menu.style.padding = "6px";
  menu.style.display = "none";
  menu.style.pointerEvents = "auto";
  const BTN_STYLE = "flex:none; min-height:40px; text-align:left; border:0; border-radius:6px; padding:8px 10px; font-size:13px; cursor:pointer; background:rgba(255,255,255,.14); color:#E8EBF2; font-family:system-ui,sans-serif;";
  const feedBtn = document.createElement("button");
  feedBtn.textContent = "\u{1F357} \u041F\u043E\u043A\u043E\u0440\u043C\u0438\u0442\u044C";
  feedBtn.style.cssText = BTN_STYLE;
  const playBtn = document.createElement("button");
  playBtn.textContent = "\u{1F3BE} \u041F\u043E\u0438\u0433\u0440\u0430\u0442\u044C";
  playBtn.style.cssText = BTN_STYLE;
  const chatBtn = document.createElement("button");
  chatBtn.textContent = "\u{1F4AC} \u041F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C";
  chatBtn.style.cssText = BTN_STYLE;
  const newsBtn = document.createElement("button");
  newsBtn.textContent = "\u{1F4F0} \u041D\u043E\u0432\u043E\u0441\u0442\u0438";
  newsBtn.style.cssText = BTN_STYLE;
  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "\u2699\uFE0F \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438";
  settingsBtn.style.cssText = BTN_STYLE;
  const statusBtn = document.createElement("button");
  statusBtn.textContent = "\u{1F433} \u041A\u0430\u043A \u0434\u0435\u043B\u0430?";
  statusBtn.style.cssText = BTN_STYLE;
  const menuGroup = (label, buttons) => {
    const group = document.createElement("div");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    group.style.cssText = "display:flex; flex-direction:column; gap:2px;";
    for (const button of buttons) {
      button.type = "button";
      button.tabIndex = -1;
      if (!button.hasAttribute("role")) button.setAttribute("role", "menuitem");
      button.addEventListener("focus", () => {
        button.style.outline = "2px solid #B7C8FE";
        button.style.outlineOffset = "-2px";
      });
      button.addEventListener("blur", () => {
        button.style.outline = "";
      });
      group.appendChild(button);
    }
    return group;
  };
  const separator = () => {
    const element = document.createElement("div");
    element.setAttribute("role", "separator");
    element.style.cssText = "height:1px; flex:none; margin:4px 6px; background:rgba(255,255,255,.14);";
    return element;
  };
  menu.append(
    menuGroup("\u041F\u0438\u0442\u043E\u043C\u0435\u0446", [statusBtn, feedBtn, playBtn]),
    separator(),
    menuGroup("\u0411\u0435\u0441\u0435\u0434\u0430", [chatBtn, newsBtn]),
    separator(),
    menuGroup("\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438", [settingsBtn])
  );
  const effects = document.createElement("div");
  effects.className = "pet-effects";
  effects.style.cssText = "position: absolute; left: 0; top: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px); pointer-events: none; overflow: visible; z-index: 2;";
  const hitarea = document.createElement("div");
  hitarea.className = "pet-hitarea";
  hitarea.style.cssText = `position: absolute; inset: 0; cursor: grab; touch-action: none; z-index: 3; border-radius: 8px;`;
  effects.appendChild(status);
  host.append(effects, stage, hitarea, menu);
  const setStatusVisible = (visible) => {
    status.style.display = visible ? "grid" : "none";
    status.style.opacity = visible ? "1" : "0";
    status.style.visibility = visible ? "visible" : "hidden";
    status.style.pointerEvents = visible ? "auto" : "none";
    status.style.transition = visible ? "opacity .2s cubic-bezier(.16,1,.3,1)" : "none";
  };
  const placeOverlay = (el2, { above, offsetY: offsetY2 }) => {
    const plan = planOverlay({
      rect: host.getBoundingClientRect(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      size: { w: el2.offsetWidth || 0, h: el2.offsetHeight || 0 },
      above,
      offsetY: offsetY2
    });
    el2.style.top = plan.top;
    el2.style.bottom = "auto";
    el2.style.right = "auto";
    el2.style.transform = plan.transform;
    el2.style.left = plan.left;
    return plan.up;
  };
  const layoutStatus = () => {
    if (activeBubble !== null || dragging || menu.classList.contains("open")) {
      setStatusVisible(false);
      return;
    }
    setStatusVisible(host.matches(":hover") || host.contains(document.activeElement));
    if (status.style.display === "none") return;
    const above = placeOverlay(status, { above: false, offsetY: 18 });
    status.classList.toggle("pet-status-above", above);
  };
  const onHostEnter = () => {
    layoutStatus();
  };
  const onHostLeave = () => {
    if (menu.classList.contains("open")) return;
    setStatusVisible(false);
  };
  host.addEventListener("mouseenter", onHostEnter);
  host.addEventListener("mouseleave", onHostLeave);
  const onBubbleShown = () => {
    layoutStatus();
  };
  const layoutMenu = () => {
    const rect = host.getBoundingClientRect();
    const room = Math.max(rect.top, window.innerHeight - rect.bottom) - 28;
    menu.style.maxHeight = `${Math.max(48, room)}px`;
    placeOverlay(menu, { above: true, offsetY: 12 });
  };
  const toggleMenu = (open, { focus = false, restoreFocus = false } = {}) => {
    const next = open ?? !menu.classList.contains("open");
    menu.classList.toggle("open", next);
    menu.style.display = next ? "flex" : "none";
    if (next) {
      layoutMenu();
      setStatusVisible(false);
      releaseInteraction();
    }
    host.setAttribute("aria-expanded", String(next));
    stage.setAttribute("aria-expanded", String(next));
    if (next && focus) {
      const first = [...menu.querySelectorAll("button")].find((item) => !item.disabled && item.style.display !== "none");
      first?.focus();
    } else if (!next && restoreFocus) stage.focus();
    return next;
  };
  const offMenuKeyboard = bindMenuKeyboard(menu, (restoreFocus) => toggleMenu(false, { restoreFocus }));
  let pet = null;
  let activity = { name: "idle", until: 0 };
  let manifest = { states: {} };
  let character = { id: "whale-girl", states: {} };
  let characterId = "whale-girl";
  const loaded = /* @__PURE__ */ new Set();
  const sheetSize = /* @__PURE__ */ new Map();
  let dragging = false;
  let pressed = false;
  let moved = false;
  let transient = null;
  let transientUntil = 0;
  let joyUntil = 0;
  let dragReleaseUntil = 0;
  let interactFromSleep = false;
  let showingSprite = false;
  let idleSince = 0;
  let sleeping = false;
  let animState = null;
  let frame = 0;
  let frameDirection = 1;
  let blinkAt = 0;
  let blinkActive = false;
  let facingAt = 0;
  let lastFrameAt = 0;
  let working = { active: false, until: 0 };
  let workingTimer = null;
  let celebrateUntil = 0;
  const animationActor = createActor(animationMachine).start();
  let walking = false;
  let walkDir = 1;
  let flip = 1;
  let wanderTimer = null;
  let walkRaf = null;
  let sessionMood = { thinking: false, waiting: false, titles: [] };
  let chatEl = null;
  let chatInput = null;
  const conversation = createActor(conversationMachine, {
    input: {
      conversationMode: cfg.voice?.conversation === true,
      voiceEnabled: cfg.voice?.enabled === true,
      userTyping: false
    }
  }).start();
  let chatOpen = false;
  let chatPending = false;
  let textPending = false;
  let listening = false;
  let recording = false;
  let transcribing = false;
  let autoListening = false;
  let speechPending = false;
  let conversationMode = cfg.voice?.conversation === true;
  const syncConversationFlags = () => {
    const next = conversationFlags(conversation.getSnapshot());
    chatOpen = next.chatOpen;
    chatPending = next.chatPending;
    textPending = next.textPending;
    speechPending = next.speechPending;
    listening = next.listening;
    recording = next.recording;
    transcribing = next.transcribing;
    autoListening = next.autoListening;
  };
  conversation.subscribe(syncConversationFlags);
  syncConversationFlags();
  const syncTyping = () => conversation.send({ type: "TYPING", userTyping: userTyping() });
  let chatGeneration = 0;
  const composerVisible = () => chatOpen && chatEl !== null && chatEl.style.display !== "none";
  let chatMic = null;
  let recognition = null;
  let revealToken = 0;
  let currentAudio = null;
  let chatterAt = 0;
  let lastChatterPhrase = null;
  let lastCelebratePhraseAt = 0;
  let lastActivityName = null;
  let lastLevel = 0;
  const deepActiveElement = () => {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element;
  };
  const textEntryFocused = () => {
    const element = deepActiveElement();
    return element instanceof HTMLElement && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable);
  };
  const chatDraftPresent = () => chatInput !== null && chatInput.value.trim() !== "";
  const userTyping = () => textEntryFocused() || chatDraftPresent();
  const renderStatus = () => {
    if (pet) {
      metaLv.textContent = `Lv.${pet.level}`;
      metaStats.textContent = pet.stats.failures > 0 ? `\u0417\u0430\u0434\u0430\u0447: ${pet.stats.tasksDone} \xB7 \u043F\u0440\u043E\u0432\u0430\u043B\u043E\u0432: ${pet.stats.failures}` : `\u0417\u0430\u0434\u0430\u0447: ${pet.stats.tasksDone}`;
      const last = pet.memory[pet.memory.length - 1];
      metaNote.textContent = last ?? (pet.titles.length > 0 ? `\u0417\u0432\u0430\u043D\u0438\u0435 \xAB${pet.titles.join("\xBB, \xAB")}\xBB` : "\u2026");
      if (status.style.visibility === "visible") layoutStatus();
    }
  };
  const showPlaceholder = (name2) => {
    sprite.classList.remove("ready");
    stage.replaceChildren(sprite);
    console.warn(`[whale-girl] \u0434\u043B\u044F \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F ${name2} \u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E sheet (manifest \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0432\u0441\u0435 15 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0439; \u0435\u0441\u043B\u0438 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u043E \u2014 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0438\u0441\u044C \u0440\u0435\u0441\u0443\u0440\u0441\u044B)`);
  };
  const sheetKey = (sheet) => `${characterId}:${sheet}`;
  const sheetUrl = (sheet) => `${ASSETS_URL}/characters/${characterId}/${sheet}`;
  const showSprite = (name2, anim) => {
    const key = sheetKey(anim.sheet);
    const size = sheetSize.get(key);
    if (!size || size.w <= 0 || size.h <= 0) {
      showPlaceholder(name2);
      return;
    }
    stage.replaceChildren(sprite);
    const frameW = size.w / anim.frames;
    const target = host.offsetWidth || 110;
    const scale = Math.min(target / frameW, target / size.h, 1);
    sprite.className = "pet-sprite ready";
    sprite.style.cssText = `
      position: absolute; left: 50%; top: 50%; display: block;
      background-image: url("${sheetUrl(anim.sheet)}");
      background-size: ${size.w}px ${size.h}px;
      width: ${frameW}px; height: ${size.h}px;
      transform: translate(-50%, -50%) scale(${scale}) scaleX(${flip});
    `;
    applyFrame(frameW, frame);
  };
  const applyFrame = (frameW, idx) => {
    sprite.style.backgroundPosition = `-${frameW * idx}px 0`;
  };
  const applyFacing = () => {
    if (!showingSprite) return;
    const cfg2 = stateOf(character, animState);
    if (!cfg2 || !loaded.has(sheetKey(cfg2.sheet))) return;
    const size = sheetSize.get(sheetKey(cfg2.sheet));
    if (!size || size.w <= 0 || size.h <= 0) return;
    const frameW = size.w / cfg2.frames;
    const target = host.offsetWidth || 110;
    const scale = Math.min(target / frameW, target / size.h, 1);
    sprite.style.transform = `translate(-50%, -50%) scale(${scale}) scaleX(${flip})`;
    applyHitArea();
  };
  const setState = (name2) => {
    if (name2 === animState) return;
    animState = name2;
    frame = 0;
    frameDirection = 1;
    blinkAt = 0;
    blinkActive = false;
    facingAt = 0;
    lastFrameAt = Date.now();
    applyHitArea();
    const motionClasses = [...stage.classList].filter((cls) => cls.startsWith("pet-motion-"));
    for (const cls of motionClasses) stage.classList.remove(cls);
    const cfg2 = stateOf(character, name2);
    const motion = cfg2?.motion;
    if (motion) stage.classList.add(`pet-motion-${motion}`);
    if (cfg2 && loaded.has(sheetKey(cfg2.sheet))) {
      showSprite(name2, cfg2);
      showingSprite = true;
    } else {
      showPlaceholder(name2);
      showingSprite = false;
    }
    stage.style.opacity = "0";
    const restoreOpacity = () => {
      stage.style.opacity = "1";
    };
    requestAnimationFrame(() => requestAnimationFrame(restoreOpacity));
    setTimeout(restoreOpacity, 60);
  };
  let stateBoxes = /* @__PURE__ */ new Map();
  const applyHitArea = () => {
    if (hitarea === null) return;
    const size = parseFloat(getComputedStyle(host).getPropertyValue("--pet-size")) || 110;
    const box = stateBoxes.get(animState ?? "") ?? { x: 0, y: 0, w: 1, h: 1 };
    const hitW = Math.max(40, size * box.w);
    const hitH = Math.max(40, size * box.h);
    const flipped = flip < 0;
    const offX = size * (flipped ? 1 - box.x - box.w : box.x);
    const offY = size * box.y;
    hitarea.style.left = `${offX}px`;
    hitarea.style.top = `${offY}px`;
    hitarea.style.width = `${hitW}px`;
    hitarea.style.height = `${hitH}px`;
  };
  const resetContentBox = () => {
    stateBoxes = /* @__PURE__ */ new Map();
  };
  const analyzeSheet = (img, frames) => {
    const canvas = document.createElement("canvas");
    const fw = img.naturalWidth / frames;
    canvas.width = fw;
    canvas.height = img.naturalHeight;
    const ctx2 = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx2 === null) return null;
    ctx2.drawImage(img, 0, 0, fw, img.naturalHeight, 0, 0, fw, img.naturalHeight);
    const data = ctx2.getImageData(0, 0, fw, canvas.height).data;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < fw; x++) {
        if ((data[(y * fw + x) * 4 + 3] ?? 0) > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return {
      x: minX / fw,
      y: minY / canvas.height,
      w: (maxX - minX + 1) / fw,
      h: (maxY - minY + 1) / canvas.height
    };
  };
  const loadImageWithRetry = (src, retries = 3) => new Promise((resolve) => {
    let attempts = 0;
    const attempt = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        attempts += 1;
        if (attempts < retries) setTimeout(attempt, 250 * attempts);
        else resolve(null);
      };
      img.src = src;
    };
    attempt();
  });
  const preload = (name2, cfg2) => loadImageWithRetry(sheetUrl(cfg2.sheet)).then((img) => {
    if (img === null) return;
    sheetSize.set(sheetKey(cfg2.sheet), { w: img.naturalWidth, h: img.naturalHeight });
    loaded.add(sheetKey(cfg2.sheet));
    const box = analyzeSheet(img, cfg2.frames);
    if (box !== null) stateBoxes.set(name2, box);
    applyHitArea();
  });
  const loadAssets = async (attempt = 1) => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const next = await res.json();
      if (next === null || typeof next !== "object") return;
      manifest = next;
      resetContentBox();
      const pref = (() => {
        try {
          return localStorage.getItem("whale-girl:character") ?? null;
        } catch {
          return null;
        }
      })();
      const roles = parseCharacters(manifest);
      const nextId = pref !== null && pref in roles.characters ? pref : roles.defaultId;
      characterId = nextId;
      character = getCharacter(manifest, nextId) ?? { id: nextId, states: {} };
      const stageSize = character.meta?.stageSize;
      if (typeof stageSize === "number" && !sizeConfigured) {
        host.style.setProperty("--pet-size", `${stageSize}px`);
      }
      const states = Object.entries(character.states);
      const idleEntry = states.find(([n]) => n === "idle");
      if (idleEntry) await preload(idleEntry[0], idleEntry[1]);
      for (const [n, cfg2] of states) if (n !== "idle") preload(n, cfg2);
    } catch {
      if (attempt < 3) setTimeout(() => loadAssets(attempt + 1), 500 * attempt);
    }
  };
  const resetTransient = (now) => {
    const wasFun = transient === "eat" || transient === "play";
    transient = null;
    transientUntil = 0;
    if (wasFun) joyUntil = now + JOY_MS;
  };
  const tick = () => {
    const now = Date.now();
    if (chatterAt === 0) chatterAt = nextChatterAt({ now });
    else if (now >= chatterAt) {
      chatterAt = nextChatterAt({ now });
      const busy = sleeping || dragging || walking || chatOpen || activeBubble !== null || menu.classList.contains("open");
      if (!busy) {
        const pool = sessionMood.waiting ? cfg.replies?.wait : sessionMood.thinking ? cfg.replies?.think : cfg.replies?.idle;
        const phrase = pickPhrase(pool, { avoid: lastChatterPhrase });
        if (phrase !== null) {
          lastChatterPhrase = phrase;
          showReply(phrase);
        }
      }
    }
    if (transient !== null && now >= transientUntil) {
      resetTransient(now);
    }
    const petThinking = replyWaitingPhase(textPending, speechPending, stage.classList.contains("pet-speaking")) !== null;
    const derive = () => {
      animationActor.send({
        type: "UPDATE",
        input: {
          activity,
          dragging,
          walking,
          transient,
          sleeping,
          joyUntil,
          dragReleaseUntil,
          now,
          sessionThink: sessionMood.thinking || petThinking,
          sessionWait: sessionMood.waiting,
          workingActive: working.active,
          celebrateUntil
        }
      });
      return animationStateOf(animationActor.getSnapshot());
    };
    let target = derive();
    if (shouldWake(animState, target, { dragging, transient })) {
      transient = "wake";
      transientUntil = now + WAKE_MS;
      target = derive();
    }
    setState(target);
    const anim = stateOf(character, animState);
    if (anim && loaded.has(sheetKey(anim.sheet))) {
      if (anim.playback !== void 0 && !["loop", "pingpong", "once", "blink"].includes(anim.playback)) {
        console.warn(`[whale-girl] \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 ${animState}: playback "${anim.playback}" \u043D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C, \u0438\u0433\u0440\u0430\u0435\u043C loop`);
      }
      const size = sheetSize.get(sheetKey(anim.sheet));
      if (!size) return;
      const frameW = size.w / anim.frames;
      if (!showingSprite) {
        showSprite(animState ?? "idle", anim);
        showingSprite = true;
        frame = 0;
        lastFrameAt = Date.now();
      }
      if ((animState === "idle" || animState === "think" || animState === "wait") && !chatOpen) {
        if (facingAt === 0) facingAt = nextFacingAt({ now });
        if (now >= facingAt) {
          flip = -flip;
          applyFacing();
          facingAt = nextFacingAt({ now });
        }
      } else if (facingAt !== 0) {
        facingAt = 0;
      }
      const holdFor = anim.frameMs?.[frame] ?? 1e3 / anim.fps;
      if (anim.frames > 1 && now - lastFrameAt >= holdFor) {
        if (anim.playback === "blink") {
          if (blinkActive) {
            lastFrameAt = now;
            frame += 1;
            if (frame >= anim.frames) {
              frame = 0;
              blinkActive = false;
              blinkAt = nextBlinkAt({ now });
            }
            applyFrame(frameW, frame);
          } else {
            if (frame !== 0) {
              frame = 0;
              applyFrame(frameW, frame);
            }
            if (blinkAt === 0) blinkAt = nextBlinkAt({ now });
            if (now >= blinkAt) blinkActive = true;
          }
          return;
        }
        lastFrameAt = now;
        frame += frameDirection;
        if (anim.playback === "pingpong" && anim.frames > 1) {
          if (frame >= anim.frames - 1 || frame <= 0) frameDirection *= -1;
          frame = Math.max(0, Math.min(anim.frames - 1, frame));
        } else if (frame >= anim.frames) {
          if (anim.playback === "loop") frame = 0;
          else {
            frame = anim.frames - 1;
            if (transient !== null && transient !== "wake") {
              resetTransient(now);
            }
          }
        }
        applyFrame(frameW, frame);
      }
    }
  };
  const releaseInteraction = () => {
    const decision = wakeFromInteraction({ visuallySleeping: interactFromSleep });
    sleeping = decision.sleeping;
    idleSince = 0;
    if (decision.wake) {
      transient = "wake";
      transientUntil = Date.now() + WAKE_MS;
    }
  };
  const spawnHearts = () => {
    for (let i = 0; i < 4; i++) {
      const heart = document.createElement("div");
      heart.className = "pet-heart";
      heart.textContent = "\u{1F497}";
      heart.style.cssText = `
        position: absolute; font-size: 20px; pointer-events: none; line-height: 1;
        left: ${20 + Math.random() * 110}px; top: ${30 + Math.random() * 80}px;
        z-index: 3; opacity: 1;
      `;
      effects.appendChild(heart);
      if (typeof heart.animate === "function") {
        heart.animate(
          [
            { opacity: 1, transform: "translateY(0) scale(.7)" },
            { opacity: 1, transform: "translateY(-60%) scale(1.25)", offset: 0.7 },
            { opacity: 0, transform: "translateY(-120%) scale(1.4)" }
          ],
          { duration: 1800, easing: "ease-out", fill: "forwards" }
        );
      }
      heart.addEventListener("animationend", () => heart.remove());
      setTimeout(() => heart.remove(), 2e3);
    }
  };
  const bubbleTimers = /* @__PURE__ */ new Set();
  let activeBubble = null;
  let speakingBubble = null;
  let waitingAnimation = null;
  const BUBBLE_TAIL_SIZE = 8;
  const BUBBLE_MAX_WIDTH = "min(280px, calc(100vw - 16px))";
  const bubbleOffsetAbove = () => 8 + (composerVisible() ? (chatEl.offsetHeight || 44) + 6 : 0);
  const clearBubble = () => {
    waitingAnimation?.cancel();
    waitingAnimation = null;
    speakingBubble = null;
    if (activeBubble !== null) {
      activeBubble.remove();
      activeBubble = null;
    }
  };
  const updateWaitingFeedback = () => {
    const phase = replyWaitingPhase(textPending, speechPending, stage.classList.contains("pet-speaking"));
    host.setAttribute("aria-busy", String(phase !== null));
    waitingAnimation?.cancel();
    waitingAnimation = null;
    const row = activeBubble?.querySelector(".pet-progress");
    if (row === null || row === void 0) return;
    row.style.display = phase === null ? "none" : "flex";
    if (phase === null) return;
    const icon = row.querySelector(".pet-progress-icon");
    icon.textContent = phase === "thinking" ? "\u{1F4AD}" : "\u{1F399}\uFE0F";
    row.querySelector(".pet-progress-label").textContent = phase === "thinking" ? "\u0414\u0443\u043C\u0430\u044E\u2026" : "\u0413\u043E\u0442\u043E\u0432\u043B\u044E \u0433\u043E\u043B\u043E\u0441\u2026";
    if (!preferReducedMotion() && typeof icon.animate === "function") {
      waitingAnimation = icon.animate([{ opacity: 0.45, transform: "translateY(0)" }, { opacity: 1, transform: "translateY(-2px)" }, { opacity: 0.45, transform: "translateY(0)" }], { duration: 1e3, iterations: Infinity });
    }
  };
  const createBubble = () => {
    const el2 = createPanel({ anchor: "above", variant: "plain", offsetY: bubbleOffsetAbove(), zIndex: "3" }).el;
    el2.className = "pet-bubble";
    el2.style.cssText += ` padding:8px 10px; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;
      max-width:${BUBBLE_MAX_WIDTH}; text-align:left; line-height:1.35;`;
    const scroll = document.createElement("div");
    scroll.className = "pet-bubble-scroll";
    scroll.style.cssText = "max-height:40vh; overflow-y:auto; overflow-x:hidden; white-space:pre-wrap; overflow-wrap:anywhere; pointer-events:auto;";
    const textEl = document.createElement("span");
    textEl.className = "pet-bubble-text";
    textEl.style.cssText = "display:block; white-space:pre-wrap; overflow-wrap:anywhere;";
    scroll.appendChild(textEl);
    const progress = document.createElement("div");
    progress.className = "pet-progress";
    progress.setAttribute("role", "status");
    progress.setAttribute("aria-live", "polite");
    progress.style.cssText = "display:none; align-items:center; gap:6px; color:#B7C8FE; font-size:11px; line-height:20px;";
    const progressIcon = document.createElement("span");
    progressIcon.className = "pet-progress-icon";
    progressIcon.setAttribute("aria-hidden", "true");
    const progressLabel = document.createElement("span");
    progressLabel.className = "pet-progress-label";
    progress.append(progressIcon, progressLabel);
    const tail = document.createElement("div");
    tail.className = "pet-bubble-tail";
    tail.setAttribute("aria-hidden", "true");
    tail.style.cssText = `position:absolute; left:50%; width:0; height:0; transform:translateX(-50%);
      border-left:${BUBBLE_TAIL_SIZE}px solid transparent; border-right:${BUBBLE_TAIL_SIZE}px solid transparent;`;
    el2.append(progress, scroll, tail);
    effects.appendChild(el2);
    activeBubble = el2;
    updateWaitingFeedback();
    return { el: el2, scroll, textEl, tail, timer: null };
  };
  const ensureLiveBubble = (bubble) => {
    if (bubble.el.isConnected) return bubble;
    const next = createBubble();
    if (typeof onBubbleShown === "function") onBubbleShown();
    return next;
  };
  const placeBubble = (bubble) => {
    const up = placeOverlay(bubble.el, { above: true, offsetY: bubbleOffsetAbove() });
    bubble.tail.style.top = up ? "auto" : `-${BUBBLE_TAIL_SIZE}px`;
    bubble.tail.style.bottom = up ? `-${BUBBLE_TAIL_SIZE}px` : "auto";
    bubble.tail.style.borderTop = up ? `${BUBBLE_TAIL_SIZE}px solid ${PANEL_THEME.bg}` : "0";
    bubble.tail.style.borderBottom = up ? "0" : `${BUBBLE_TAIL_SIZE}px solid ${PANEL_THEME.bg}`;
    const rect = bubble.el.getBoundingClientRect();
    if (rect.width > 0) {
      const pet2 = host.getBoundingClientRect();
      const petCenter = pet2.left + pet2.width / 2;
      const tail = Math.min(Math.max(14, petCenter - rect.left), rect.width - 14);
      bubble.tail.style.left = `${tail}px`;
    }
    return up;
  };
  const reserveBubbleHeight = (bubble) => {
    const height = bubble.scroll.clientHeight;
    if (height > 0) bubble.scroll.style.minHeight = `${height}px`;
  };
  const animateBubble = (el2, up) => {
    if (typeof el2.animate !== "function") {
      el2.style.opacity = "1";
      return;
    }
    el2.animate(
      [
        { opacity: 0, transform: up ? "translate(-50%, -85%)" : "translate(-50%, -15%)" },
        { opacity: 1, transform: up ? "translate(-50%, -100%)" : "translateX(-50%)" }
      ],
      { duration: 250, easing: "ease-out", fill: "forwards" }
    );
  };
  const disarmBubble = (bubble) => {
    if (bubble.timer !== null) {
      clearTimeout(bubble.timer);
      if (bubble.timer !== null) bubbleTimers.delete(bubble.timer);
      bubble.timer = null;
    }
  };
  const armBubble = (bubble, ms) => {
    disarmBubble(bubble);
    bubble.timer = setTimeout(() => {
      if (bubble.timer !== null) bubbleTimers.delete(bubble.timer);
      bubble.timer = null;
      if (bubbleWaitsForSpeech({ speechPending, isSpeakingBubble: speakingBubble?.bubble === bubble, isActive: activeBubble === bubble.el })) {
        armBubble(bubble, ms);
        return;
      }
      if (speakingBubble?.bubble === bubble) speakingBubble = null;
      if (activeBubble === bubble.el) activeBubble = null;
      bubble.el.remove();
      if (typeof onBubbleShown === "function") onBubbleShown();
      finishChatWhenIdle();
    }, Math.max(250, ms));
    bubbleTimers.add(bubble.timer);
  };
  const showTypingBubble = () => {
    clearBubble();
    const bubble = createBubble();
    animateBubble(bubble.el, placeBubble(bubble));
    if (typeof onBubbleShown === "function") onBubbleShown();
    armBubble(bubble, 3e4);
    return bubble;
  };
  const showReply = (text, { ms } = {}) => {
    if (menu.classList.contains("open")) toggleMenu(false);
    clearBubble();
    const bubble = createBubble();
    const message = typeof text === "string" ? text : String(text ?? "");
    bubble.textEl.textContent = message;
    reserveBubbleHeight(bubble);
    animateBubble(bubble.el, placeBubble(bubble));
    if (typeof onBubbleShown === "function") onBubbleShown();
    armBubble(bubble, typeof ms === "number" ? ms : cfg.bubbleMs);
    return bubble;
  };
  const chatBubbleMs = (text) => chatBubbleDuration(text, cfg.bubbleMs);
  const chatEnabled = () => cfg.chat?.enabled !== false;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  let chatGreeted = false;
  const ensureChat = () => {
    if (chatEl !== null) return chatEl;
    const panel = document.createElement("form");
    panel.setAttribute("data-whale-girl-chat", "");
    panel.setAttribute("aria-label", "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u0438\u0442\u043E\u043C\u0446\u0443");
    panel.style.cssText = `position: fixed; z-index: 2147483001; display: flex; gap: 6px; align-items: center;
      width: min(300px, calc(100vw - 16px)); box-sizing: border-box; padding: 6px 8px; margin: 0;
      background: rgba(24,28,38,.97); border: 1px solid rgba(255,255,255,.10); border-radius: 12px;
      box-shadow: 0 18px 44px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.3);
      color: #E8EBF2; font-family: system-ui, sans-serif; font-size: 12px;`;
    const mic = document.createElement("button");
    mic.type = "button";
    mic.textContent = "\u{1F399}";
    mic.setAttribute("aria-label", "\u0421\u043A\u0430\u0437\u0430\u0442\u044C \u0433\u043E\u043B\u043E\u0441\u043E\u043C");
    mic.title = "\u0421\u043A\u0430\u0437\u0430\u0442\u044C \u0433\u043E\u043B\u043E\u0441\u043E\u043C";
    mic.style.cssText = "border:0; border-radius:8px; background:rgba(255,255,255,.10); color:#fff; cursor:pointer; padding:6px 8px; font-size:12px; flex:none;";
    mic.addEventListener("click", () => {
      void toggleMic();
    });
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "\u041D\u0430\u043F\u0438\u0448\u0438 \u0438\u043B\u0438 \u0441\u043A\u0430\u0436\u0438\u2026";
    input.setAttribute("aria-label", "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u0438\u0442\u043E\u043C\u0446\u0443");
    input.maxLength = 500;
    input.style.cssText = "flex:1; min-width:0; border:1px solid rgba(255,255,255,.14); border-radius:8px; background:rgba(255,255,255,.06); color:#E8EBF2; font:inherit; font-size:12px; padding:6px 8px; outline:none;";
    const send = document.createElement("button");
    send.type = "submit";
    send.textContent = "\u27A4";
    send.setAttribute("aria-label", "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C");
    send.style.cssText = "border:0; border-radius:8px; background:rgba(86,134,254,.85); color:#fff; cursor:pointer; padding:6px 10px; font-size:12px; flex:none;";
    panel.style.flexWrap = "wrap";
    panel.append(mic, input, send);
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendChat();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void sendChat();
      }
      if (event.key === "Escape") closeChat();
    });
    input.addEventListener("focus", () => {
      stopWalk();
      syncTyping();
      if (autoListening) cancelMicrophone();
    });
    input.addEventListener("input", () => {
      syncTyping();
      if (input.value.trim() !== "") cancelMicrophone();
    });
    input.addEventListener("blur", () => {
      syncTyping();
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    document.body.appendChild(panel);
    chatEl = panel;
    chatInput = input;
    chatMic = mic;
    updateMic();
    return panel;
  };
  const positionChat = () => {
    if (chatEl === null) return;
    const rect = host.getBoundingClientRect();
    const width = chatEl.offsetWidth || 300;
    const height = chatEl.offsetHeight || 44;
    const plan = planOverlay({
      rect,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      size: { w: width, h: height },
      above: true,
      offsetY: 8
    });
    const top = plan.up ? rect.top - 8 - height : rect.bottom + 8;
    const left = rect.left + rect.width / 2 - width / 2 + plan.shift;
    chatEl.style.left = `${clamp(left, 8, Math.max(8, window.innerWidth - width - 8))}px`;
    chatEl.style.top = `${clamp(top, 8, Math.max(8, window.innerHeight - height - 8))}px`;
    chatEl.style.right = "auto";
    chatEl.style.bottom = "auto";
  };
  const preferReducedMotion = () => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  };
  const revealText = async (bubble, text) => {
    const token = revealToken + 1;
    revealToken = token;
    bubble.textEl.textContent = "";
    bubble.scroll.scrollTop = 0;
    if (preferReducedMotion() || text.length > 400) {
      bubble.textEl.textContent = text;
      bubble.scroll.scrollTop = bubble.scroll.scrollHeight;
      return;
    }
    for (let index = 1; index <= text.length; index += 1) {
      if (revealToken !== token || !bubble.el.isConnected) return;
      bubble.textEl.textContent = text.slice(0, index);
      bubble.scroll.scrollTop = bubble.scroll.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const stopListening = () => {
    if (recognition !== null) {
      try {
        recognition.stop();
      } catch {
      }
      recognition = null;
    }
    conversation.send({ type: "LISTEN_END" });
    updateMic();
  };
  const updateMic = () => {
    if (chatMic === null) return;
    const active = recording || listening || transcribing;
    chatMic.textContent = active ? "\u23F9" : "\u{1F399}";
    chatMic.style.background = active ? "rgba(240,90,90,.75)" : "rgba(255,255,255,.10)";
    chatMic.setAttribute("aria-pressed", active ? "true" : "false");
    chatMic.title = active ? "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C" : "\u0421\u043A\u0430\u0437\u0430\u0442\u044C \u0433\u043E\u043B\u043E\u0441\u043E\u043C";
    chatMic.setAttribute("aria-label", chatMic.title);
  };
  const listenOnce = (auto = false) => {
    if (!chatEnabled()) return;
    if (!chatOpen) openChat();
    if (chatInput === null) return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (typeof Recognition !== "function") {
      if (!auto) showReply("\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u0443\u043C\u0435\u0435\u0442 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u0442\u044C \u0440\u0435\u0447\u044C. \u041D\u0430\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C \u2014 \u044F \u0442\u0443\u0442.");
      return;
    }
    stopListening();
    syncTyping();
    if (auto && !canAutoListen(conversation.getSnapshot())) return;
    try {
      const instance = new Recognition();
      recognition = instance;
      instance.lang = "ru-RU";
      instance.interimResults = false;
      instance.maxAlternatives = 1;
      instance.onstart = () => {
        if (recognition === instance) updateMic();
      };
      instance.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (recognition !== instance || !chatOpen) return;
        if (autoListening && userTyping()) {
          conversation.send({ type: "LISTEN_END" });
          return;
        }
        if (typeof transcript === "string" && transcript.trim() !== "" && chatInput !== null) {
          chatInput.value = transcript.trim();
          conversation.send({ type: "LISTEN_END" });
          void sendChat();
        }
      };
      instance.onerror = (event) => {
        if (recognition !== instance || !chatOpen) return;
        const wasAuto = autoListening;
        conversation.send({ type: "LISTEN_END" });
        if (wasAuto) return;
        showReply(voiceErrorMessage(typeof event?.error === "string" ? event.error : ""));
      };
      instance.onend = () => {
        if (recognition !== instance) return;
        recognition = null;
        conversation.send({ type: "LISTEN_END" });
        updateMic();
      };
      conversation.send(auto ? { type: "LISTEN_AUTO", mode: "browser" } : { type: "LISTEN_MANUAL", mode: "browser" });
      instance.start();
    } catch {
      conversation.send({ type: "LISTEN_END" });
      updateMic();
      if (!auto) showReply("\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D. \u041D\u0430\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C \u2014 \u044F \u0442\u0443\u0442.");
    }
  };
  let transcriptionGeneration = 0;
  const uploadAudio = async (blob, mime) => {
    const generation = transcriptionGeneration;
    const wasAuto = autoListening;
    conversation.send({ type: "TRANSCRIBE_START" });
    updateMic();
    try {
      const res = await fetch(TRANSCRIBE_PATH, {
        method: "POST",
        headers: { "content-type": mime || "audio/webm" },
        body: blob
      });
      const body = await res.json().catch(() => null);
      if (!chatOpen || generation !== transcriptionGeneration) return;
      if (!res.ok) {
        if (!wasAuto) showReply(voiceErrorMessage(body?.error));
        return;
      }
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (text === "") {
        if (!wasAuto) showReply("\u041D\u0435 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u043B\u0430 \u0441\u043B\u043E\u0432\u0430. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437 \u0438\u043B\u0438 \u043D\u0430\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C.");
        return;
      }
      if (wasAuto && userTyping()) return;
      if (chatInput !== null) chatInput.value = text;
      await sendChat();
    } catch {
      if (!wasAuto && chatOpen && generation === transcriptionGeneration) showReply(voiceErrorMessage(null));
    } finally {
      conversation.send({ type: "TRANSCRIBE_END" });
      updateMic();
    }
  };
  const microphone = createMicrophoneCapture({
    allowed: () => chatOpen && cfg.voice.enabled === true && cfg.voice.provider !== "browser",
    acquire: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    create: (stream) => new MediaRecorder(stream),
    recording: (active) => {
      if (!active) {
        setTimeout(() => {
          const flags = conversationFlags(conversation.getSnapshot());
          if (flags.listening || flags.recording) conversation.send({ type: "LISTEN_END" });
        }, 0);
      }
      updateMic();
    },
    audio: (blob, mime) => {
      void uploadAudio(blob, mime);
    },
    error: (error) => {
      const wasAuto = autoListening;
      conversation.send({ type: "LISTEN_END" });
      if (!wasAuto) showReply(voiceErrorMessage(error instanceof Error && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture"));
    }
  });
  const stopRecording = () => microphone.stop(true);
  const startRecording = () => microphone.start();
  const serverStt = () => cfg.voice?.enabled === true && cfg.voice?.provider !== "browser";
  const toggleMic = async (auto = false) => {
    syncTyping();
    if (auto && !canAutoListen(conversation.getSnapshot())) return;
    if (transcribing) {
      cancelMicrophone();
      return;
    }
    if (recording) {
      stopRecording();
      return;
    }
    if (microphone.busy()) return;
    if (listening) {
      stopListening();
      return;
    }
    if (speechPending) {
      if (auto) return;
      stopSpeaking();
    }
    if (cfg.voice.provider === "subscription") {
      if (!auto) showReply(voiceErrorMessage("voice-subscription-unsupported"));
      return;
    }
    if (cfg.voice.provider !== "browser" && cfg.voice.enabled !== true) {
      if (!auto) showReply(voiceErrorMessage("voice-disabled"));
      return;
    }
    if (serverStt()) {
      if (!chatOpen) openChat();
      if (typeof window.MediaRecorder !== "function" || navigator.mediaDevices?.getUserMedia === void 0) {
        if (!auto) showReply("\u0417\u0430\u043F\u0438\u0441\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041E\u0442\u043A\u0440\u043E\u0439 DSH \u0447\u0435\u0440\u0435\u0437 localhost \u0438\u043B\u0438 HTTPS \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438 \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D.");
        return;
      }
      conversation.send(auto ? { type: "LISTEN_AUTO", mode: "server" } : { type: "LISTEN_MANUAL", mode: "server" });
      try {
        await startRecording();
      } catch {
        conversation.send({ type: "LISTEN_END" });
      }
      return;
    }
    listenOnce(auto);
  };
  const conversationResume = createConversationResume(
    () => chatOpen && canAutoListen(conversation.getSnapshot()) && !recording && !listening && !transcribing && !userTyping(),
    () => {
      void toggleMic(true);
    }
  );
  const maybeConversationListen = () => {
    syncTyping();
    conversationResume.schedule();
  };
  const cancelMicrophone = () => {
    transcriptionGeneration += 1;
    conversationResume.cancel();
    microphone.cancel();
    conversation.send({ type: "CANCEL" });
    stopListening();
  };
  const setSpeaking = (on) => {
    try {
      stage.classList.toggle("pet-speaking", on);
    } catch {
    }
    updateWaitingFeedback();
  };
  const closeChat = () => {
    conversation.send({ type: "CLOSE" });
    chatGeneration += 1;
    cancelMicrophone();
    revealToken += 1;
    clearBubble();
    stopListening();
    if (chatEl !== null) chatEl.style.display = "none";
    if (chatInput !== null) chatInput.blur();
    stopSpeaking();
    layoutStatus();
    scheduleWander();
  };
  const finishChatWhenIdle = () => {
    if (chatOpen && !composerVisible() && !chatPending && !speechPending && !conversationMode && activeBubble === null) closeChat();
  };
  const dismissChatInput = () => {
    if (chatEl !== null) chatEl.style.display = "none";
    chatInput?.blur();
    cancelMicrophone();
  };
  const openChat = () => {
    if (!chatEnabled()) return;
    const panel = ensureChat();
    panel.style.display = "flex";
    conversation.send(chatOpen ? { type: "COMPOSE" } : { type: "OPEN" });
    toggleMenu(false);
    releaseInteraction();
    stopWalk();
    positionChat();
    if (!textPending && !speechPending) clearBubble();
    else if (activeBubble !== null) placeOverlay(activeBubble, { above: true, offsetY: bubbleOffsetAbove() });
    layoutStatus();
    if (!chatGreeted) {
      chatGreeted = true;
      showReply("\u041F\u0440\u0438\u0432\u0435\u0442! \u042F \u0442\u0443\u0442. \u041E \u0447\u0451\u043C \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u043C?");
    }
    if (chatInput !== null) {
      setTimeout(() => {
        try {
          if (composerVisible()) chatInput?.focus();
        } catch {
        }
      }, 0);
    }
  };
  const toggleChat = () => {
    if (composerVisible()) closeChat();
    else openChat();
  };
  const askSessionStatus = () => {
    toggleMenu(false);
    if (!chatEnabled() || chatPending) return;
    if (!chatOpen) openChat();
    if (chatInput === null) return;
    chatInput.value = SESSION_STATUS_QUESTION;
    void sendChat();
  };
  const sendChat = async () => {
    if (chatInput === null || chatPending) return;
    const text = chatInput.value.replace(/\s+/g, " ").trim();
    if (text === "") return;
    conversation.send({ type: "SEND" });
    const generation = chatGeneration;
    chatInput.value = "";
    stopSpeaking();
    dismissChatInput();
    syncTyping();
    let typing = showTypingBubble();
    try {
      const res = await fetch(CHAT_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, sessionId: currentSessionId(ctx.sessions?.list?.getSnapshot()) })
      });
      const body = await res.json().catch(() => null);
      if (generation !== chatGeneration || !chatOpen) return;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      conversation.send({ type: "REPLY" });
      updateWaitingFeedback();
      const reply = typeof body?.reply === "string" && body.reply !== "" ? body.reply : "\u2026";
      const bubbleText = typeof body?.bubble === "string" && body.bubble !== "" ? body.bubble : reply;
      const speech = typeof body?.speech === "string" && body.speech !== "" ? body.speech : reply;
      typing = ensureLiveBubble(typing);
      disarmBubble(typing);
      typing.textEl.textContent = reply;
      reserveBubbleHeight(typing);
      placeBubble(typing);
      let spoken = false;
      await presentChatReply({
        current: () => generation === chatGeneration && chatOpen && activeBubble === typing.el,
        speak: () => {
          if (chatOpen && shouldSpeakReply(speech, cfg.voice)) spoken = speak(speech);
          placeBubble(typing);
        },
        reveal: () => revealText(typing, reply),
        finish: () => {
          const readMs = chatBubbleMs(bubbleText);
          if (spoken) speakingBubble = { bubble: typing, ms: readMs };
          armBubble(typing, readMs);
          conversation.send({ type: "REVEALED" });
        }
      });
    } catch {
      if (generation !== chatGeneration || !chatOpen) return;
      conversation.send({ type: "FAIL" });
      updateWaitingFeedback();
      const message = "\u0425\u043C\u2026 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437!";
      typing = ensureLiveBubble(typing);
      typing.textEl.textContent = message;
      reserveBubbleHeight(typing);
      placeBubble(typing);
      armBubble(typing, chatBubbleMs(message));
    } finally {
      updateWaitingFeedback();
      finishChatWhenIdle();
      if (chatInput !== null && composerVisible() && generation === chatGeneration) {
        const active = document.activeElement;
        const inside = active === null || active === document.body || active === chatInput;
        if (inside) {
          try {
            chatInput.focus();
          } catch {
          }
        }
      }
    }
  };
  const syncChatAvailability = () => {
    for (const button of [chatBtn, statusBtn, newsBtn]) button.style.display = chatEnabled() ? "" : "none";
    if (!chatEnabled() && chatOpen) closeChat();
  };
  const speechRequest = createSpeechRequest();
  let releaseAudio = null;
  let speechSession = 0;
  const stopSpeaking = () => {
    speechSession += 1;
    conversation.send({ type: "SPEAK_END" });
    speechRequest.cancel();
    try {
      window.speechSynthesis?.cancel();
    } catch {
    }
    if (currentAudio !== null) {
      try {
        currentAudio.pause();
      } catch {
      }
      currentAudio = null;
    }
    releaseAudio?.();
    releaseAudio = null;
    setSpeaking(false);
  };
  const pickBrowserVoice = () => {
    const synth = window.speechSynthesis;
    if (synth === void 0) return null;
    let voices = [];
    try {
      voices = synth.getVoices();
    } catch {
      return null;
    }
    if (!Array.isArray(voices) || voices.length === 0) return null;
    const wanted = typeof cfg.voice?.voice === "string" ? cfg.voice.voice.trim().toLowerCase() : "";
    if (wanted !== "") {
      const exact = voices.find((voice) => typeof voice.name === "string" && voice.name.toLowerCase() === wanted);
      if (exact !== void 0) return exact;
    }
    return voices.find((voice) => typeof voice.lang === "string" && voice.lang.toLowerCase().startsWith("ru")) ?? null;
  };
  const finishSpeechSession = (session, resumeListening) => {
    if (session !== speechSession) return;
    conversation.send({ type: "SPEAK_END" });
    setSpeaking(false);
    const held = speakingBubble;
    speakingBubble = null;
    if (held !== null && activeBubble === held.bubble.el) armBubble(held.bubble, held.ms);
    if (resumeListening) maybeConversationListen();
    finishChatWhenIdle();
  };
  const speakBrowserChunk = (text, tone, signal) => new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (synth === void 0 || typeof SpeechSynthesisUtterance !== "function") {
      resolve(false);
      return;
    }
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.pitch = tone === "cheerful" ? 1.12 : tone === "calm" ? 0.95 : 1;
      utterance.rate = typeof cfg.voice?.rate === "number" ? Math.min(2, Math.max(0.5, cfg.voice.rate)) : 1;
      const voice = pickBrowserVoice();
      if (voice !== null) utterance.voice = voice;
      utterance.onstart = () => {
        if (speechRequest.current(signal)) setSpeaking(true);
      };
      utterance.onend = () => done(true);
      utterance.onerror = () => done(false);
      signal.addEventListener("abort", () => done(false), { once: true });
      synth.speak(utterance);
    } catch {
      done(false);
    }
  });
  const playAudioBlob = (blob, signal) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      if (releaseAudio === cleanup) releaseAudio = null;
    };
    const done = (ok, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error !== void 0) reject(error);
      else resolve(ok);
    };
    releaseAudio = cleanup;
    audio.addEventListener("ended", () => done(true), { once: true });
    audio.addEventListener("error", () => done(false), { once: true });
    audio.addEventListener("playing", () => {
      if (speechRequest.current(signal)) setSpeaking(true);
    }, { once: true });
    signal.addEventListener("abort", () => {
      try {
        audio.pause();
      } catch {
      }
      done(false);
    }, { once: true });
    audio.play().catch(() => done(false, new Error("playback blocked")));
  });
  const prepareModelChunk = async (text, tone, signal, stream) => {
    try {
      const res = await fetch(VOICE_PATH, {
        signal,
        method: "POST",
        headers: { "content-type": "application/json", accept: stream && typeof AudioContext === "function" ? "audio/pcm" : "audio/*" },
        body: JSON.stringify({ text, tone })
      });
      if (!res.ok) {
        const failure = await res.json().catch(() => null);
        throw new Error(typeof failure?.error === "string" ? failure.error : `HTTP ${res.status}`);
      }
      if (res.headers.get("content-type")?.toLowerCase().startsWith("audio/pcm")) return { kind: "pcm", response: res };
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("empty audio");
      return { kind: "blob", blob };
    } catch (error) {
      return { kind: "failed", error };
    }
  };
  const playPreparedChunk = async (prepared, signal) => {
    if (prepared.kind === "failed") throw prepared.error;
    if (prepared.kind === "pcm") {
      await playPcmResponse(prepared.response, { signal, onPlaying: () => {
        if (speechRequest.current(signal)) setSpeaking(true);
      } });
      return speechRequest.current(signal);
    }
    if (!speechRequest.current(signal) || cfg.voice.enabled !== true) return false;
    return playAudioBlob(prepared.blob, signal);
  };
  const speakModelSpeech = async (chunks, tone, signal, session) => {
    const first = chunks[0];
    if (first === void 0) return true;
    const prepared = [prepareModelChunk(first, tone, signal, true)];
    for (let index = 0; index < chunks.length; index += 1) {
      const lookAhead = chunks[index + 1];
      if (lookAhead !== void 0 && prepared[index + 1] === void 0) {
        prepared[index + 1] = prepareModelChunk(lookAhead, tone, signal, false);
      }
      const pending = prepared[index];
      const chunkText = chunks[index];
      if (pending === void 0 || chunkText === void 0) return true;
      let chunk = await pending;
      if (session !== speechSession || signal.aborted) return true;
      if (chunk.kind === "failed") {
        chunk = await prepareModelChunk(chunkText, tone, signal, false);
        if (session !== speechSession || signal.aborted) return true;
      }
      if (chunk.kind === "failed") throw chunk.error;
      const ok = await playPreparedChunk(chunk, signal);
      if (session !== speechSession) return true;
      if (!ok) {
        finishSpeechSession(session, false);
        return false;
      }
    }
    return true;
  };
  const speak = (text) => {
    const voice = cfg.voice;
    if (voice?.enabled !== true || typeof text !== "string") return false;
    const chunks = splitSpeechChunks(text, VOICE_TEXT_MAX);
    if (chunks.length === 0) return false;
    const tone = speechTone(text);
    stopSpeaking();
    const session = speechSession;
    const signal = speechRequest.start();
    conversation.send({ type: "SPEAK_START" });
    updateWaitingFeedback();
    void (async () => {
      try {
        if (voice.provider === "browser") {
          for (const chunk of chunks) {
            if (session !== speechSession || signal.aborted) return;
            const ok = await speakBrowserChunk(chunk, tone, signal);
            if (session !== speechSession) return;
            if (!ok) {
              finishSpeechSession(session, false);
              return;
            }
          }
        } else {
          const ok = await speakModelSpeech(chunks, tone, signal, session);
          if (!ok) return;
        }
        finishSpeechSession(session, true);
      } catch (error) {
        if (session !== speechSession) return;
        finishSpeechSession(session, false);
        const code = error instanceof Error ? error.message : "";
        showReply(code.startsWith("voice-") || code.startsWith("tts-") ? voiceErrorMessage(code) : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0437\u0432\u0443\u0447\u0438\u0442\u044C \u043E\u0442\u0432\u0435\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0433\u043E\u043B\u043E\u0441\u0430 \u0438 \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0441\u0435\u0440\u0432\u0438\u0441\u0443.");
      }
    })();
    return true;
  };
  const interact = async (action) => {
    stopWalk();
    releaseInteraction();
    transient = action === "feed" ? "eat" : "play";
    transientUntil = Date.now() + TRANSIENT_MS;
    try {
      const res = await fetch(INTERACT_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (body?.reply) showReply(body.reply, { ms: chatBubbleMs(body.reply) });
      spawnHearts();
    } catch {
    }
    await refresh();
  };
  let refreshing = false;
  let failStreak = 0;
  let lastConfigRevision = 0;
  let sizeConfigured = false;
  let lastMemoryAt = 0;
  let pollTimer = null;
  const fetchConfig = async () => {
    try {
      const res = await fetch(CONFIG_PATH);
      if (!res.ok) return null;
      const body = await res.json();
      return body !== null && typeof body === "object" ? body.config : null;
    } catch {
      return null;
    }
  };
  const applyClientConfig = (config) => {
    if (config === null || typeof config !== "object") return;
    if (config.enabled === false) {
      disposePet();
      return;
    }
    const prevPollMs = cfg.pollMs;
    const previousVoiceProvider = cfg.voice.provider;
    cfg = { ...CFG_DEFAULTS, ...config };
    if (typeof config.size === "number") {
      sizeConfigured = true;
      host.style.setProperty("--pet-size", `${config.size}px`);
      if (host.style.left) {
        const x = Math.max(0, Math.min(parseFloat(host.style.left) || 0, window.innerWidth - host.offsetWidth));
        const y = Math.max(0, Math.min(parseFloat(host.style.top) || 0, window.innerHeight - host.offsetHeight));
        host.style.left = `${x}px`;
        host.style.top = `${y}px`;
      }
    }
    if (typeof config.opacity === "number") host.style.setProperty("--pet-opacity", String(config.opacity));
    if (typeof config.pollMs === "number" && config.pollMs !== prevPollMs && document.visibilityState === "visible") {
      clearInterval(pollTimer ?? void 0);
      pollTimer = setInterval(refresh, cfg.pollMs);
    }
    scheduleWander();
    if (config.voice?.enabled === false || previousVoiceProvider !== cfg.voice.provider) {
      stopSpeaking();
      cancelMicrophone();
    }
    if (config.voice?.conversation !== true) conversationResume.cancel();
    conversationMode = config.voice?.conversation === true;
    conversation.send({
      type: "CONFIG",
      conversationMode,
      voiceEnabled: cfg.voice.enabled === true,
      userTyping: userTyping()
    });
    if (chatOpen) positionChat();
    syncChatAvailability();
    finishChatWhenIdle();
  };
  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      const res = await fetch(STATE_PATH);
      if (!res.ok) throw new Error(`state ${res.status}`);
      const body = await res.json();
      if (body !== null && typeof body === "object" && body.pet !== null && typeof body.pet === "object") {
        const nextPet = body.pet;
        pet = nextPet;
        if (Number.isInteger(nextPet.level)) {
          if (lastLevel !== 0 && nextPet.level > lastLevel) {
            const phrase = pickPhrase(cfg.replies?.levelUp, { avoid: lastChatterPhrase });
            if (phrase !== null && !speechPending) {
              lastChatterPhrase = phrase;
              showReply(phrase);
            }
            spawnHearts();
          }
          lastLevel = nextPet.level;
        }
      }
      const act = body?.activity;
      if (act !== null && typeof act === "object" && typeof act.name === "string") {
        activity = act;
        const name2 = act.name;
        const now = Date.now();
        if (lastActivityName !== null && name2 !== lastActivityName && !speechPending && (name2 === "welcome" || name2 === "celebrate" || name2 === "error" || name2 === "disappointed") && (name2 !== "celebrate" || celebratePhraseDue({ lastAt: lastCelebratePhraseAt, now }))) {
          const phrase = pickPhrase(cfg.replies?.[name2], { avoid: lastChatterPhrase });
          if (phrase !== null) {
            lastChatterPhrase = phrase;
            if (name2 === "celebrate") lastCelebratePhraseAt = now;
            showReply(phrase);
          }
        }
        lastActivityName = name2;
      }
      if (act !== null && typeof act === "object") {
        sessionMood = {
          thinking: act.sessionThink === true,
          waiting: act.sessionWait === true,
          titles: []
        };
        if (Number.isFinite(act.turnCompletedUntil) && act.turnCompletedUntil > Date.now()) {
          celebrateUntil = Math.max(celebrateUntil, act.turnCompletedUntil);
        } else if (act.turnCompleted === true) {
          celebrateUntil = Math.max(celebrateUntil, Date.now() + TURN_COMPLETED_MS);
        }
        armWorking();
      }
      const isActive = activity.name !== "idle" || activity.until > Date.now();
      if (isActive) {
        idleSince = 0;
      } else if (idleSince === 0) {
        idleSince = Date.now();
      }
      sleeping = activity.name === "idle" && idleSince !== 0 && Date.now() - idleSince > cfg.sleepAfterMs;
      if (typeof body?.configRevision === "number" && body.configRevision !== lastConfigRevision) {
        lastConfigRevision = body.configRevision;
        const config = await fetchConfig();
        if (config !== null) applyClientConfig(config);
        syncChatAvailability();
      }
      const nextCompanion = body?.companionOnline === true;
      if (nextCompanion !== companionOnline) {
        companionOnline = nextCompanion;
        syncInert();
      }
      const memory = body?.memory;
      if (memory !== null && typeof memory === "object" && Number.isFinite(memory.at) && memory.at !== lastMemoryAt) {
        lastMemoryAt = memory.at;
        const line = memoryLine(memory);
        if (line !== null) showReply(line);
      }
      failStreak = 0;
      renderStatus();
    } catch {
      failStreak += 1;
      if (failStreak >= 3) metaNote.textContent = "\u{1F4E1} \u041D\u0435 \u0432 \u0441\u0435\u0442\u0438\u2026";
    } finally {
      refreshing = false;
    }
  };
  let startX = 0;
  let startY = 0;
  let lastPointerX = 0;
  let offsetX = 0;
  let offsetY = 0;
  const POS_KEY = "whale-girl:pos";
  const savePos = () => {
    try {
      if (host.style.left && host.style.top) {
        localStorage.setItem(POS_KEY, JSON.stringify({ x: parseFloat(host.style.left), y: parseFloat(host.style.top) }));
      }
    } catch {
    }
  };
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      const x = Math.max(0, Math.min(raw.x, window.innerWidth - host.offsetWidth));
      const y = Math.max(0, Math.min(raw.y, window.innerHeight - host.offsetHeight));
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";
    }
  } catch {
  }
  hitarea.addEventListener("pointerdown", (e) => {
    pressed = true;
    dragging = false;
    moved = false;
    interactFromSleep = animState === "sleep";
    stopWalk();
    startX = e.clientX;
    startY = e.clientY;
    lastPointerX = e.clientX;
    offsetX = e.clientX - host.offsetLeft;
    offsetY = e.clientY - host.offsetTop;
  });
  hitarea.addEventListener("pointermove", (e) => {
    if (!pressed) return;
    if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 6) {
      if (!moved) hitarea.setPointerCapture(e.pointerId);
      moved = true;
      dragging = true;
      transient = null;
      transientUntil = 0;
      joyUntil = 0;
      layoutStatus();
      const nextFlip = facingFromDrag(e.clientX - lastPointerX, flip);
      if (nextFlip !== flip) {
        flip = nextFlip;
        const dragCfg = stateOf(character, "drag");
        if (animState === "drag" && dragCfg && loaded.has(sheetKey(dragCfg.sheet))) showSprite("drag", dragCfg);
        applyHitArea();
      }
    }
    lastPointerX = e.clientX;
    if (!moved) return;
    const x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - host.offsetWidth));
    const y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - host.offsetHeight));
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
    if (menu.classList.contains("open")) layoutMenu();
  });
  hitarea.addEventListener("pointerup", (e) => {
    pressed = false;
    dragging = false;
    const wasMoved = moved;
    if (hitarea.hasPointerCapture(e.pointerId)) hitarea.releasePointerCapture(e.pointerId);
    if (wasMoved) {
      savePos();
      dragReleaseUntil = Date.now() + DRAG_RELEASE_MS;
      releaseInteraction();
      moved = false;
    }
    layoutStatus();
    if (chatOpen) positionChat();
    if (!wasMoved && !(e.target instanceof Element && e.target.closest("button"))) toggleMenu();
  });
  const onDragAbort = () => {
    pressed = false;
    dragging = false;
    if (moved) {
      dragReleaseUntil = Date.now() + DRAG_RELEASE_MS;
      releaseInteraction();
      moved = false;
    }
    layoutStatus();
    if (chatOpen) positionChat();
  };
  hitarea.addEventListener("pointercancel", onDragAbort);
  hitarea.addEventListener("lostpointercapture", onDragAbort);
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      interactFromSleep = animState === "sleep";
      toggleMenu(true, { focus: true });
    }
  });
  const onDocPointerDown = (e) => {
    if (host.contains(e.target) || chatEl !== null && chatEl.contains(e.target)) return;
    toggleMenu(false);
    if (composerVisible()) closeChat();
  };
  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    const menuOpen = menu.classList.contains("open");
    toggleMenu(false, { restoreFocus: menuOpen });
    closeChat();
  };
  document.addEventListener("pointerdown", onDocPointerDown);
  document.addEventListener("keydown", onKeyDown);
  statusBtn.addEventListener("click", askSessionStatus);
  settingsBtn.addEventListener("click", () => {
    toggleMenu(false);
    closeChat();
    try {
      if (ctx.pluginNavigation === void 0) throw new Error("Plugin navigation unavailable");
      ctx.pluginNavigation.openBundle(SETTINGS_NAMESPACE);
    } catch {
      showReply("\u2699\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438. \u041E\u0442\u043A\u0440\u043E\u0439 \xAB\u041F\u043B\u0430\u0433\u0438\u043D\u044B\xBB \u2192 \xAB\u041A\u0438\u0442-\u0434\u0435\u0432\u043E\u0447\u043A\u0430\xBB.");
    }
  });
  hitarea.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    toggleMenu(true, { focus: true });
  });
  feedBtn.addEventListener("click", () => {
    toggleMenu(false);
    void interact("feed");
  });
  playBtn.addEventListener("click", () => {
    toggleMenu(false);
    void interact("play");
  });
  chatBtn.addEventListener("click", () => {
    toggleMenu(false);
    toggleChat();
  });
  newsBtn.addEventListener("click", () => {
    toggleMenu(false);
    if (!chatEnabled()) return;
    if (!chatOpen) openChat();
    if (chatInput === null) return;
    chatInput.value = "\u0420\u0430\u0441\u0441\u043A\u0430\u0436\u0438 \u0441\u0432\u0435\u0436\u0438\u0435 \u043D\u043E\u0432\u043E\u0441\u0442\u0438";
    void sendChat();
  });
  const onPetSay = (e) => {
    if (!(e instanceof CustomEvent)) return;
    if (e.detail && typeof e.detail.text === "string" && e.detail.text.length > 0) showReply(e.detail.text);
  };
  const onPetFx = (e) => {
    if (!(e instanceof CustomEvent)) return;
    if (e.detail?.type === "hearts") spawnHearts();
  };
  const onPetStatus = (e) => {
    if (!(e instanceof CustomEvent)) return;
    if (e.detail && typeof e.detail.text === "string") {
      metaNote.textContent = e.detail.text;
      if (status.style.visibility === "visible") layoutStatus();
      setTimeout(() => {
        if (metaNote.textContent === e.detail.text) renderStatus();
      }, 2500);
    }
  };
  document.addEventListener("whale-girl:say", onPetSay);
  document.addEventListener("whale-girl:fx", onPetFx);
  document.addEventListener("whale-girl:status", onPetStatus);
  const stopWalk = () => {
    walking = false;
    if (walkRaf !== null) {
      cancelAnimationFrame(walkRaf);
      walkRaf = null;
    }
    scheduleWander();
  };
  const scheduleWander = () => {
    clearTimeout(wanderTimer ?? void 0);
    if (!host.isConnected) return;
    if (!cfg.walk.enabled) return;
    const wait = cfg.walk.minWaitMs + Math.random() * (cfg.walk.maxWaitMs - cfg.walk.minWaitMs);
    wanderTimer = setTimeout(() => {
      if (sleeping || sessionMood.thinking || sessionMood.waiting || chatOpen || dragging) {
        scheduleWander();
        return;
      }
      wander();
    }, wait);
  };
  const wander = () => {
    if (!host.isConnected || chatOpen || dragging) return;
    walking = true;
    walkDir = Math.random() < 0.5 ? 1 : -1;
    flip = -walkDir;
    const walkCfg = stateOf(character, "walk");
    if (animState === "walk" && walkCfg && loaded.has(sheetKey(walkCfg.sheet))) showSprite("walk", walkCfg);
    applyHitArea();
    const duration = cfg.walk.minMs + Math.random() * (cfg.walk.maxMs - cfg.walk.minMs);
    const start = performance.now();
    const maxX = Math.max(0, window.innerWidth - host.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - host.offsetHeight);
    const rect = host.getBoundingClientRect();
    const startLeft = Math.min(Math.max(rect.left, 0), maxX);
    const startTop = Math.min(Math.max(rect.top, 0), maxY);
    host.style.left = `${startLeft}px`;
    host.style.top = `${startTop}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
    const step = (t) => {
      if (sleeping || dragging || sessionMood.thinking || sessionMood.waiting || chatOpen) {
        stopWalk();
        return;
      }
      const x = startLeft + walkDir * cfg.walk.speedPxPerSec * ((t - start) / 1e3);
      if (x <= 0 || x >= maxX || t - start >= duration) {
        host.style.left = `${Math.min(maxX, Math.max(0, x))}px`;
        host.style.top = `${startTop}px`;
        stopWalk();
        return;
      }
      host.style.left = `${x}px`;
      host.style.top = `${startTop}px`;
      walkRaf = requestAnimationFrame(step);
    };
    walkRaf = requestAnimationFrame(step);
  };
  const armWorking = () => {
    if (!sessionMood.thinking) {
      if (workingTimer !== null) clearTimeout(workingTimer);
      workingTimer = null;
      working = { active: false, until: 0 };
      return;
    }
    if (workingTimer !== null) return;
    const decision = nextWorkingRhythm({ now: Date.now(), sessionThink: true, working, random: Math.random });
    const delay = Math.max(0, decision.until - Date.now());
    workingTimer = setTimeout(() => {
      workingTimer = null;
      working = { active: decision.active, until: 0 };
      armWorking();
    }, delay);
  };
  let animTimer = null;
  let sse = null;
  const boot = async () => {
    const config = await fetchConfig();
    if (config !== null && config.enabled === false) {
      disposePet();
      return;
    }
    if (config !== null) applyClientConfig(config);
    host.style.display = "";
    loadAssets();
    refresh();
    pollTimer = setInterval(refresh, cfg.pollMs);
    animTimer = setInterval(tick, TICK_MS);
    scheduleWander();
    armWorking();
    try {
      sse = new EventSource(EVENTS_PATH);
      sse.onmessage = () => refresh();
    } catch {
    }
  };
  boot();
  let testFlag = false;
  try {
    testFlag = new URLSearchParams(window.location.search).has("whale-girl-test") || window.sessionStorage.getItem("whale-girl-test") === "1";
  } catch {
  }
  if (testFlag) {
    window.__whaleGirlTest = {
      walkNow: () => {
        sleeping = false;
        sessionMood = { thinking: false, waiting: false, titles: [] };
        wander();
      },
      stopWalk,
      position: () => {
        const rect = host.getBoundingClientRect();
        return { left: Math.round(rect.left), top: Math.round(rect.top) };
      },
      isChatOpen: () => chatOpen,
      isWalking: () => walking
    };
  }
  armWorking();
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      if (pollTimer === null) pollTimer = setInterval(refresh, cfg.pollMs);
      if (animTimer === null) animTimer = setInterval(tick, TICK_MS);
      refresh();
    } else {
      if (pollTimer !== null) {
        clearInterval(pollTimer ?? void 0);
        pollTimer = null;
      }
      if (animTimer !== null) {
        clearInterval(animTimer);
        animTimer = null;
      }
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onResize = () => {
    if (host.style.left) {
      const x = Math.max(0, Math.min(parseFloat(host.style.left) || 0, window.innerWidth - host.offsetWidth));
      const y = Math.max(0, Math.min(parseFloat(host.style.top) || 0, window.innerHeight - host.offsetHeight));
      host.style.left = `${x}px`;
      host.style.top = `${y}px`;
    }
    layoutStatus();
    if (menu.classList.contains("open")) layoutMenu();
    if (chatOpen) positionChat();
  };
  window.addEventListener("resize", onResize);
  let pageHidden = null;
  let companionOnline = false;
  const ownDialogs = () => Array.from(document.querySelectorAll('[role="dialog"]')).map((element) => ({
    ownedByPet: element.closest("[data-whale-girl-chat],[data-whale-girl]") !== null,
    visible: element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true"
  }));
  const syncInert = () => {
    const dialog = shouldDimForDialogs(ownDialogs());
    const onboarding = document.getElementById("deepseek-onboarding-title") !== null || document.querySelector('[aria-labelledby="deepseek-onboarding-title"]') !== null;
    const next = onboarding ? "onboarding" : companionOnline ? "companion" : dialog ? "dialog" : null;
    if (next !== pageHidden) {
      pageHidden = next;
      if (next === "onboarding" || next === "companion") {
        if (chatOpen) closeChat();
        host.setAttribute("data-whale-girl-hidden", "");
        host.removeAttribute("data-whale-girl-inert");
        host.style.display = "none";
        host.style.opacity = "";
      } else if (next === "dialog") {
        host.removeAttribute("data-whale-girl-hidden");
        host.style.display = "";
        host.setAttribute("data-whale-girl-inert", "");
        host.style.opacity = ".6";
      } else {
        host.removeAttribute("data-whale-girl-inert");
        host.removeAttribute("data-whale-girl-hidden");
        host.style.display = "";
        host.style.opacity = "";
      }
    }
  };
  const dialogObserver = new MutationObserver(syncInert);
  dialogObserver.observe(document.body, { childList: true, subtree: true });
  syncInert();
  const disposePet = () => {
    clearInterval(pollTimer ?? void 0);
    if (animTimer !== null) clearInterval(animTimer);
    if (sse !== null) sse.close();
    clearTimeout(wanderTimer ?? void 0);
    if (workingTimer !== null) clearTimeout(workingTimer);
    if (walkRaf !== null) cancelAnimationFrame(walkRaf);
    for (const t of bubbleTimers) clearTimeout(t);
    bubbleTimers.clear();
    clearBubble();
    dialogObserver.disconnect();
    offMenuKeyboard();
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("whale-girl:say", onPetSay);
    document.removeEventListener("whale-girl:fx", onPetFx);
    document.removeEventListener("whale-girl:status", onPetStatus);
    host.removeEventListener("mouseenter", onHostEnter);
    host.removeEventListener("mouseleave", onHostLeave);
    window.removeEventListener("resize", onResize);
    closeChat();
    clearTimeout(wanderTimer ?? void 0);
    wanderTimer = null;
    stopSpeaking();
    if (chatEl !== null) {
      chatEl.remove();
      chatEl = null;
      chatInput = null;
      chatMic = null;
    }
    host.remove();
    style.remove();
  };
  const dispose = () => {
    disposePet();
    if (offSettings !== null) {
      offSettings();
      offSettings = null;
    }
  };
  return dispose;
}
var name = "whale-girl";
var inject = ["slots", "locale", "configForms", "sessions", "pluginNavigation"];
		return module.exports;
	}
});
