# Sumplete – Kubernetes deployment

Ez a `sum_local` alkalmazás kanonikus Kubernetes-repója. Erőforrások: `sum-local`, `sum-local-service:8080`; publikus útvonal: `/sumplete/`; Redis-prefix: `sumplete:session`.

## Telepítés és frissítés

```bash
cd ~/codes/sum_local_kub
git pull --ff-only
KUBECTL='sudo k3s kubectl' ./update.sh --target nuc --dry-run
KUBECTL='sudo k3s kubectl' ./update.sh --target nuc
```

Előfeltétel: Docker, Git, Bash, működő k3s, Redis és ingress. A korábbi manifestek helye: `~/.local/state/nicqx-apps/nuc/sum-local/`.

## Ellenőrzés

```bash
sudo k3s kubectl get pod,service -n default -l app=sum-local -o wide
sudo k3s kubectl logs deployment/sum-local -n default --tail=50
curl -fsSI https://pmqxyz.hopto.org/sumplete/ | head -n 1
```

## Migráció

A konténer állapotmentes. Előbb a `redis` repo eljárásával migráld a `sumplete:session*` kulcsokat, utána klónozd ezt a repót és futtasd az update-et. Külön PVC nincs.

## Leállítás, rollback és eltávolítás

```bash
sudo k3s kubectl scale deployment/sum-local -n default --replicas=0
sudo k3s kubectl scale deployment/sum-local -n default --replicas=1
sudo k3s kubectl apply -f /teljes/ut/korabbi-manifest.yaml
sudo k3s kubectl rollout status deployment/sum-local -n default --timeout=180s
sudo k3s kubectl delete deployment/sum-local service/sum-local-service -n default
```

Az eltávolítás nem töröl Redis-adatot vagy ingress-szabályt.
