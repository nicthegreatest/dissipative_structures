import base64
import os

data_uri = "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="
header, encoded = data_uri.split(",", 1)
data = base64.b64decode(encoded)

if not os.path.exists('public'):
    os.makedirs('public')

with open("public/dot.png", "wb") as f:
    f.write(data)
