
import '@testing-library/jest-dom';


if (typeof setImmediate === 'undefined') {
  
  global.setImmediate = (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args);
}
