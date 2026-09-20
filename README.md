# Sumplete

Teljes frissítés NUC-on:

```bash
KUBECTL='sudo k3s kubectl' ./update.sh --target nuc --dry-run
KUBECTL='sudo k3s kubectl' ./update.sh --target nuc
```

Pi5 esetén a cél `--target pi5`. A script ellenőrzi a célclustert, menti az
előző manifesteket, natív image-et épít és importál a k3s containerd-be, majd
megvárja a rolloutot. A mentések helye:
`~/.local/state/nicqx-apps/<target>/sum-local/`.

## Régi kézi parancsok

to start (vagy ha csak a konfig frissült):
kubectl apply -f sum_local_deployment.yaml

to stop (temporaly):
kubectl scale deployment sum-local --replicas=0

to stop (permanently):
kubectl delete -f sum_local_deployment.yaml

to reach:
localhost:8080

to test:
kubectl get pods

Kódfrissítés kezelése

Amikor módosítod a sum_local kódját (például egy kódfrissítést végzel):

    Frissítsd a kódot és építsd újra a Docker képet:

docker build -t sum_local:latest .

Exportálás:

docker save sum_local:latest -o sum_local.tar

Importálás a containerd-be:

sudo k3s ctr image import sum_local.tar

Frissítsd a k3s deployment-et de előtte le kell skálázni (ha nem recreate a stratégia akkor kell leskálázni):

kubectl scale deployment sum-local --replicas=0

kubectl set image deployment/sum-local sum-local=sum_local:latest

kubectl scale deployment sum-local --replicas=1

Ez új podot indít az új képpel, majd a régi podot leállítja.
akkor nem kell leskálázni ha ez van a deployment yamlben

spec:

  strategy:

    type: Recreate

