def check_website(url):
 import requests
 try:
 r = requests.get(url, timeout=5)
 return f"Status: {r.status_code}, Headers: {r.headers}"
 except:
 return "Connection Failed."

tools.append(
 Tool(
 name="Web Penetrator",
 func=check_website,
 description="Checks a URL status and headers."
 )
)