#!/bin/bash

# Yazıcı v4 "DEHŞET" CLI
# Kullanım: ./yazici.sh [start|setup|token]

WORKSPACE_DIR="$HOME/Yazıcı-Workspace"
CONFIG_DIR="$HOME/.yazici"

# ─── Fonksiyonlar ────────────────────────────────────────────────────────────

function setup() {
    echo "✦ Yazıcı v4 kuruluyor..."
    mkdir -p "$WORKSPACE_DIR"
    mkdir -p "$CONFIG_DIR"
    npm install
    npm run build
    echo "✓ Kurulum tamamlandı."
}

function start() {
    echo "✦ Yazıcı v4 başlatılıyor..."
    export WORKSPACE_ROOT="$WORKSPACE_DIR"
    
    # Otomatik tarayıcı açma (Sessiz ve arka planda)
    (sleep 2 && (xdg-open "http://localhost:3147" || open "http://localhost:3147") &> /dev/null ) &

    npm run dev || {
        echo -e "\n❌ Hata: Uygulama başlatılamadı. Bağımlılıkları kontrol edin."
        return 1
    }
}

function token() {
    if [ -z "$1" ]; then
        echo "Kullanım: ./yazici.sh token [yeni-token]"
    else
        echo "YAZICI_TOKEN=$1" > "$CONFIG_DIR/token"
        echo "✓ Token kaydedildi."
    fi
}

# ─── Ana Mantık ──────────────────────────────────────────────────────────────

CMD=${1:-start}
shift || true

case "$CMD" in
    setup) setup ;;
    start) 
        if [ ! -d "node_modules" ]; then
            echo "✦ Bağımlılıklar bulunamadı, otomatik kurulum başlatılıyor..."
            setup
        fi
        
        # Port temizliği
        echo "✦ Port 3147 kontrol ediliyor..."
        fuser -k 3147/tcp &>/dev/null || true
        
        start 
        ;;
    token) token "$@" ;;
    *) 
        echo "Kullanım: ./yazici.sh [start|setup|token]"
        exit 1
        ;;
esac
