import qrcode

url = "https://tobiasduerschmid.github.io/SEBook/tools/regex.html#quick-reference"
img = qrcode.make(url)
img.save("regex_tool_qr.png")