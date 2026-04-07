import qrcode

url = "https://tobiasduerschmid.github.io/SEBook/tools/regex.html#quick-reference"
url ="https://tobiasduerschmid.github.io/SEBook/tools/python-lecture-tutorial"
img = qrcode.make(url)
img.save("regex_tool_qr.png")