# Dev helper: simular la "fecha actual" (FECHA_ACTUAL) y reiniciar Next.
#
# El bloqueo de predicciones de partidos YA NO depende de la fecha — lo
# gestiona el administrador a mano desde /admin/results por jornada
# (rounds.predictions_locked_at). Ver
# `documentation/user_guides/bloqueo_predicciones.md`.
#
# `FECHA_ACTUAL` sigue siendo útil para simular el lock de predicciones
# iniciales (campeón / subcampeón / pichichi / mejor jugador /
# clasificados de grupo), que sí se cierra automáticamente cuando
# app_now() llega a `initial_predictions_lock_at()` (por defecto, el
# arranque del torneo).
#
# Uso:
#   make fecha FECHA=2026-06-12T09:00   # simular (predicciones iniciales bloqueadas)
#   make fecha FECHA=2026-06-01         # simular (iniciales aún abiertas)
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
