#!/usr/bin/env python3
"""
Custom HTTP server for the Lab Scanner application
Handles MIME types and CORS properly for JavaScript modules
"""

import http.server
import socketserver
import mimetypes
import os
from pathlib import Path

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Ensure proper MIME types for JavaScript
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.css'):
            self.send_header('Content-Type', 'text/css')
        elif self.path.endswith('.html'):
            self.send_header('Content-Type', 'text/html')
        
        super().end_headers()
    
    def do_GET(self):
        # If requesting root, serve index.html
        if self.path == '/':
            self.path = '/index.html'
        
        return super().do_GET()
    
    def log_message(self, format, *args):
        # Custom logging to show what's being served
        message = format % args
        if '404' in message:
            print(f"❌ 404 Error: {message}")
        elif '200' in message:
            print(f"✅ Served: {args[0]}")
        else:
            print(f"📡 {message}")

if __name__ == "__main__":
    PORT = 8000
    
    # Ensure we have proper MIME types
    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('text/css', '.css')
    mimetypes.add_type('text/html', '.html')
    
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"🚀 Lab Scanner Server starting at http://localhost:{PORT}")
        print("📁 Serving files from:", os.getcwd())
        print("🔧 Features: CORS enabled, proper MIME types")
        print("=" * 50)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
