type HomeTabDoublePressListener = () => void;

const homeTabDoublePressListeners = new Set<HomeTabDoublePressListener>();

export function emitHomeTabDoublePress() {
  for (const listener of homeTabDoublePressListeners) {
    listener();
  }
}

export function addHomeTabDoublePressListener(
  listener: HomeTabDoublePressListener
) {
  homeTabDoublePressListeners.add(listener);

  return () => {
    homeTabDoublePressListeners.delete(listener);
  };
}
