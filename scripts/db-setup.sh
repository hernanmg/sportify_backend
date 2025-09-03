#!/bin/bash

# Script para manejo de la base de datos PostgreSQL con Docker

case "$1" in
  start)
    echo "🚀 Iniciando contenedores PostgreSQL y pgAdmin..."
    docker-compose up -d postgres pgadmin
    echo "✅ Contenedores iniciados!"
    echo "📊 PostgreSQL: localhost:5445"
    echo "🔧 pgAdmin: http://localhost:8080"
    echo "   Email: admin@sportify.com"
    echo "   Password: admin123"
    ;;
  stop)
    echo "🛑 Deteniendo contenedores..."
    docker-compose down
    echo "✅ Contenedores detenidos!"
    ;;
  restart)
    echo "🔄 Reiniciando contenedores..."
    docker-compose down
    docker-compose up -d postgres pgadmin
    echo "✅ Contenedores reiniciados!"
    ;;
  logs)
    echo "📋 Mostrando logs de PostgreSQL..."
    docker-compose logs -f postgres
    ;;
  reset)
    echo "⚠️  ADVERTENCIA: Esto eliminará todos los datos de la base de datos!"
    read -p "¿Estás seguro? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "🗑️  Eliminando volúmenes y contenedores..."
      docker-compose down -v
      docker volume rm sportify_amateur_postgres_data sportify_amateur_pgadmin_data 2>/dev/null || true
      echo "✅ Base de datos reiniciada!"
    else
      echo "❌ Operación cancelada"
    fi
    ;;
  status)
    echo "📊 Estado de los contenedores:"
    docker-compose ps
    ;;
  connect)
    echo "🔌 Conectando a PostgreSQL..."
    docker exec -it sportify_postgres psql -U sportify_user -d sportify_amateur
    ;;
  *)
    echo "🐘 Script de gestión de base de datos Sportify Amateur"
    echo ""
    echo "Uso: $0 {start|stop|restart|logs|reset|status|connect}"
    echo ""
    echo "Comandos:"
    echo "  start   - Inicia PostgreSQL y pgAdmin"
    echo "  stop    - Detiene todos los contenedores"
    echo "  restart - Reinicia los contenedores"
    echo "  logs    - Muestra los logs de PostgreSQL"
    echo "  reset   - ⚠️  Elimina todos los datos y reinicia"
    echo "  status  - Muestra el estado de los contenedores"
    echo "  connect - Conecta al CLI de PostgreSQL"
    echo ""
    echo "Conexiones:"
    echo "  PostgreSQL: localhost:5445"
    echo "  pgAdmin: http://localhost:8080"
    exit 1
    ;;
esac
