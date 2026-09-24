.PHONY: check dev migrate-local deploy-local

check:
	npm --prefix api run build
	cargo fmt --check
	cargo build
	cargo test

dev:
	./scripts/local.sh dev

migrate-local:
	./scripts/local.sh migrate

deploy-local: migrate-local
	docker build -t deploy-api:local ./api
	docker build -t deploy-controller:local -f crates/controller/Dockerfile .
	kubectl apply -k manifests/overlays/local
	kubectl rollout restart deployment/api deployment/controller -n deploy-system
	kubectl rollout status deployment/api -n deploy-system
	kubectl rollout status deployment/controller -n deploy-system
