# Aditya Sridhar — portfolio

Live at **https://adityasridhar.vercel.app**: models trained from scratch and runnable in the browser, research, patents and open-source work.

## Model zoo

Every model was trained by the script in its folder, exported to ONNX, and runs client-side with onnxruntime-web. Each model page cites the log line behind every number and the commit it was trained at.

| Model | Data | Params | Result | Code |
|---|---|---|---|---|
| MLP in NumPy | MNIST | 109,386 | 98.69% test accuracy | `training/mlp_numpy` |
| Small CNN | MNIST | 7,578 | 99.41% test accuracy | `training/cnn_mnist` |
| CNN | CIFAR-10 | 288,746 | 89.69% test accuracy | `training/cnn_cifar10` |
| ResNet-56 (vs plain-56) | CIFAR-10 | 853,018 | 91.70% (plain-56: 81.90%) | `training/resnet_cifar10` |
| VAE, 2-D latent | MNIST | 1,068,820 | test ELBO -137.02 nats | `training/vae_mnist` |
| DCGAN | MNIST | 546,177 | class entropy 3.30 / 3.32 bits | `training/dcgan_mnist` |
| LSTM forecaster | Delhi 5-min load | 204,300 | 1.06% MAPE, 1 h ahead, 2024 | `training/lstm_load` |
| Mini-GPT | Tiny Shakespeare | 818,048 | 2.11 bits/char validation | `training/mini_gpt` |
| ViT-Tiny | CIFAR-10 | 1,806,538 | 82.68% test accuracy | `training/vit_cifar10` |

Train any of them with `.venv/Scripts/python training/<folder>/train.py` (PyTorch, NumPy, onnx, onnxruntime). Data is downloaded and checksummed by the scripts, except the Delhi load data, which comes from Kaggle (see `training/lstm_load/train.py`).

Two interactive studies use scikit-learn and LightGBM on CPU:

| Study | Data | Result | Code |
|---|---|---|---|
| Fraud alert budget (`/projects/fraud`) | Sparkov simulated card transactions | random forest PR-AUC 0.954 on the last 6 months | `training/fraud_sparkov` |
| Solar-aware forecasting (`/research/solar-forecasting`) | Delhi 5-min load, same windows as the LSTM | LightGBM 0.87% MAPE vs LSTM 1.06%; sun features help only the linear model | `training/solar_forecast` |

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # typecheck + lint + build + Playwright tests
BASE_URL=https://adityasridhar.vercel.app npx playwright test   # the same tests against the live site
```

Stack: Next.js (App Router), TypeScript, CSS Modules with design tokens in `src/app/globals.css`, React Three Fiber for the hero, onnxruntime-web (WebAssembly, self-hosted under `public/ort/`) for the models.

## Data credits

- MNIST (LeCun, Cortes and Burges), CIFAR-10 (Krizhevsky), Tiny Shakespeare (Karpathy, char-rnn).
- Delhi 5-Minute Electricity Demand for Forecasting, yug201 on Kaggle, CC BY 4.0.
