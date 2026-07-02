#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.VISITOR_OS_API_URL = "${VISITOR_OS_API_URL:-}";
EOF

