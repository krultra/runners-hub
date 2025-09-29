# Operations (Build & Deploy)

## Build

- Production build
  
  ```bash
  npm run build
  ```

- Test build (uses `.env.test`)
  
  ```bash
  npm run build:test
  ```

## Serve locally

```bash
npm start        # dev
npm run start:test
```

## Deploy

- Test (Hosting → `runnershubtest`)

```bash
npm run deploy:test
```

- Production (Hosting → `runnershub-62442`)

```bash
npm run deploy
```

## Firestore Rules & Indexes

- Test
  
  ```bash
  npm run deploy:rules:test
  npm run deploy:indexes:test
  ```

- Production
  
  ```bash
  npm run deploy:rules
  npm run deploy:indexes
  ```

## Cloud Functions

- Test
  
  ```bash
  npm run deploy:functions:test
  ```

- Production
  
  ```bash
  npm run deploy:functions
  ```
