# Dev helper: simular la "fecha actual" (FECHA_ACTUAL) y reiniciar Next.
#
# El bloqueo de predicciones iniciales se evalúa contra app_now()
# (= FECHA_ACTUAL si está, si no now() real). El primer partido del
# torneo de test es 2026-06-11 22:00 Madrid: una fecha POSTERIOR congela
# las predicciones y las hace públicas; ANTERIOR (o vacía) = abiertas.
#
# Uso:
#   make fecha FECHA=2026-06-12T09:00   # simular (torneo empezado)
#   make fecha FECHA=2026-06-01         # simular (aún abierto)
#   make fecha FECHA=                   # volver a la fecha real
#
# Reescribe la línea FECHA_ACTUAL de .env.local y reinicia `npm run dev`
# (Next lee el env solo al arrancar). Recarga el navegador después.

.PHONY: fecha run

fecha:
	@if grep -qE '^#? *FECHA_ACTUAL=' .env.local 2>/dev/null; then \
		sed -i '' -E 's|^#? *FECHA_ACTUAL=.*|FECHA_ACTUAL=$(FECHA)|' .env.local; \
	else \
		printf '\nFECHA_ACTUAL=$(FECHA)\n' >> .env.local; \
	fi
	@echo ">> .env.local: FECHA_ACTUAL=$(FECHA)"
	@pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; true
	@sleep 2
	@(npm run dev > /tmp/dev08.log 2>&1 &)
	@sleep 8
	@tail -3 /tmp/dev08.log
	@echo ">> dev reiniciado. Recarga el navegador."

run:
	@npm run dev