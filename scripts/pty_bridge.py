#!/usr/bin/env python3
"""
Zero-dependency PTY bridge for terminal AI agents (agy, claude, opencode, etc.).
Spawns the target agent in a real pseudo-terminal (PTY) and communicates via JSON Lines over stdio.
"""
import pty
import os
import sys
import select
import json
import signal
import struct
import termios
import fcntl

def emit(msg_type, **kwargs):
    kwargs["type"] = msg_type
    sys.stdout.write(json.dumps(kwargs) + "\n")
    sys.stdout.flush()

def main():
    if len(sys.argv) < 2:
        emit("error", message="No command provided to pty bridge")
        sys.exit(1)

    cmd = sys.argv[1:]
    master_fd, slave_fd = pty.openpty()
    # Interactive agents use terminal dimensions to decide whether and how to
    # draw their prompt. A zero-sized PTY can leave Codex in control-code-only
    # mode and make transmitted input appear to disappear.
    winsize = struct.pack("HHHH", 40, 120, 0, 0)
    fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

    pid = os.fork()
    if pid == 0:
        # Child process
        os.close(master_fd)
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)
        
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["FORCE_COLOR"] = "1"
        try:
            os.execvpe(cmd[0], cmd, env)
        except Exception as e:
            sys.stderr.write(f"Exec failed: {e}\n")
            sys.exit(1)

    # Parent process
    os.close(slave_fd)
    emit("started", pid=pid, command=" ".join(cmd))

    # Read loop using select on master_fd and stdin
    stdin_fd = sys.stdin.fileno()

    # Set non-blocking on master_fd
    fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    buffer = ""

    while True:
        try:
            rlist, _, _ = select.select([master_fd, stdin_fd], [], [], 0.05)
        except (KeyboardInterrupt, select.error):
            break

        if master_fd in rlist:
            try:
                data = os.read(master_fd, 4096)
                if not data:
                    break
                text = data.decode("utf-8", errors="replace")
                emit("output", data=text)
            except OSError:
                break

        if stdin_fd in rlist:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                payload = json.loads(line.strip())
                action = payload.get("action")
                if action == "write":
                    content = payload.get("data", "")
                    os.write(master_fd, content.encode("utf-8"))
                elif action == "resize":
                    cols = payload.get("cols", 80)
                    rows = payload.get("rows", 24)
                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                elif action == "kill":
                    os.kill(pid, signal.SIGTERM)
                    break
            except Exception:
                pass

        # Check if child is still alive
        ret = os.waitpid(pid, os.WNOHANG)
        if ret != (0, 0):
            # A short-lived command such as `codex exec` can exit with its
            # answer still buffered in the PTY. Drain it before reporting exit.
            while True:
                try:
                    data = os.read(master_fd, 4096)
                    if not data:
                        break
                    emit("output", data=data.decode("utf-8", errors="replace"))
                except OSError:
                    break
            emit("exit", code=ret[1])
            break

    os.close(master_fd)

if __name__ == "__main__":
    main()
