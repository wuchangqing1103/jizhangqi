// The DSH Windows sandbox blocks Node's child_process pipes, which makes Vite's
// one-time `exec("net use")` probe throw EPERM while loading its config.
// This local test shim answers that single probe ("no network drives") without
// spawning anything, then leaves every other exec call untouched.
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'

const originalExec = childProcess.exec

childProcess.exec = function patchedExec(command, options, callback) {
  if (command === 'net use') {
    const done = typeof options === 'function' ? options : callback
    queueMicrotask(() => done?.(null, '', ''))
    return { on() {}, once() {}, kill() {}, unref() {} }
  }
  return originalExec.apply(this, arguments)
}

syncBuiltinESMExports()