import subprocess
import time

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True)
    return result.stdout

def screenshot(path="screenshots/screen.png"):
    cmd = f"adb exec-out screencap -p > {path}"
    subprocess.run(cmd, shell=True)
    return path

def tap(x, y):
    cmd = f"adb shell input tap {x} {y}"
    subprocess.run(cmd, shell=True)

def swipe(x1, y1, x2, y2, duration=300):
    cmd = f"adb shell input swipe {x1} {y1} {x2} {y2} {duration}"
    subprocess.run(cmd, shell=True)

def input_text(text):
    safe_text = text.replace(" ", "%s")
    cmd = f'adb shell input text "{safe_text}"'
    subprocess.run(cmd, shell=True)