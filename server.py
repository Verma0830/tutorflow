import http.server
import socketserver
import webbrowser
import os

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

# Change directory to the app folder to serve its contents
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class MyHTTPRequestHandler(Handler):
    def end_headers(self):
        # Enable CORS and disable caching during dev for smooth updates
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# Get local network IP address
import socket
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

local_ip = get_local_ip()

# Find an available port if 8000 is occupied
port = PORT
while True:
    try:
        with socketserver.TCPServer(("", port), MyHTTPRequestHandler) as httpd:
            print(f"\n=======================================================")
            print(f" TutorFlow Attendance Server is Running!")
            print(f" Access the App at:")
            print(f"   - On Laptop: http://localhost:{port}")
            print(f"   - On Mom's Phone: http://{local_ip}:{port} (Same Wi-Fi)")
            print(f" Press Ctrl+C in this terminal to stop the server.")
            print(f"=======================================================\n")
            
            # Open browser window automatically
            webbrowser.open(f"http://localhost:{port}")
            
            httpd.serve_forever()
            break
    except OSError:
        # Port already in use, try next one
        port += 1
