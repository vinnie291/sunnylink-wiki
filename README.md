# Sunnylink Wiki

The complete wiki for Sunnypilot settings, models, and features. This project provides a searchable and filterable interface for exploring Sunnypilot configuration options.

## Features

- **Searchable Database**: Quickly find settings and toggles.
- **Categorized View**: Browse settings by categories (e.g., Lateral Controls, Longitudinal Tuning).
- **Responsive Design**: Optimized for both desktop and mobile viewing with a "glassmorphism" aesthetic.
- **Dynamic Content**: Data is loaded from JSON configuration files.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/vinnie291/sunnylink-wiki.git
    cd sunnylink-wiki
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

This application is configured for deployment on **Google Cloud Run**.

### Quick Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Google Cloud.

Basic command (after setup):
```bash
gcloud run deploy sunnylink-wiki-service --source .
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
