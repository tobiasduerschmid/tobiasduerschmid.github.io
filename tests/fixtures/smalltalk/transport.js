/** Hold genuine channel delivery at an observable phase; never substitute VM responses. */
function installSmalltalkTransportGate() {
  const NativeChannel = window.MessageChannel;
  const onmessage = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage');
  const NativeWorker = window.Worker;
  let gate = null;
  window.smalltalkWorkerCount = 0;
  window.Worker = function (...args) {
    const worker = new NativeWorker(...args);
    window.smalltalkWorkerCount++;
    const terminate = worker.terminate.bind(worker);
    let ended = false;
    worker.terminate = () => { if (!ended) { ended = true; window.smalltalkWorkerCount--; } terminate(); };
    return worker;
  };
  window.holdSmalltalkReply = matches => {
    let held, release;
    const promise = new Promise(resolve => { held = resolve; });
    gate = { matches, capture(deliver) { gate = null; release = deliver; held(); } };
    return { held: promise, release: () => release() };
  };
  window.MessageChannel = function () {
    const channel = new NativeChannel(), requests = new Map();
    const send = channel.port1.postMessage.bind(channel.port1);
    channel.port1.postMessage = message => { if (message.requestId) requests.set(message.requestId, message); send(message); };
    Object.defineProperty(channel.port1, 'onmessage', {
      set(listener) {
        onmessage.set.call(channel.port1, listener && (event => {
          const request = requests.get(event.data.requestId);
          if (gate && gate.matches(request, event.data)) gate.capture(() => listener(event));
          else listener(event);
        }));
      },
    });
    return channel;
  };
}
module.exports = { installSmalltalkTransportGate };
