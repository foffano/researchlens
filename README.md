# ResearchLens AI

ResearchLens AI is a powerful desktop application designed to supercharge academic research. Built with **Electron** and **React**, it leverages Google's **Gemini AI** models to automatically analyze, summarize, and extract structured data from research papers (PDFs).

![ResearchLens AI](https://placeholder.com/researchlens-banner) 
*(Note: Replace with actual screenshot)*

## 🚀 Features

- **📄 Automated PDF Analysis**: Drag and drop research papers to automatically extract metadata (Title, Authors, Publication Year, DOI, Article Type).
- **🧠 Intelligent Extraction**: Pre-configured prompts to extract:
  - Problem Statements
  - Key Results & Findings
  - Methodologies
  - Summaries
  - Limitations
- **✍️ Custom Analysis Columns**: Define your own extraction columns with custom natural language prompts (e.g., "What dataset was used?", "What is the main contribution?").
- **📂 Organization**: Create folders to manage different research projects or topics.
- **⚡ Model Flexibility**: Switch between different Gemini models (e.g., Gemini 1.5 Flash, Gemini 2.5 Flash) for cost/performance optimization.
- **📤 Data Export**: Export your entire analysis library or specific folders to CSV for further use in Excel or other tools.
- **🔒 Privacy-Focused**: Your data and API keys are stored locally on your machine.

## 🛠️ Tech Stack

- **Core**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **AI Integration**: [Google GenAI SDK](https://github.com/google/google-gemini-client)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (via CDN)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/researchlens-ai.git
   cd researchlens-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **(Optional) Environment Setup**
   Create a `.env.local` file in the root directory if you want to bundle a default API key (not recommended for public repos):
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

## 🏃‍♂️ Usage

### Development Mode

You can run the application in two modes:

1. **Web Browser Mode** (UI only, limited file system access):
   ```bash
   npm run dev
   ```

2. **Electron Desktop Mode** (Full functionality):
   ```bash
   npm run electron:dev
   ```

### Building for Production

To create a distributable installer for your OS (Windows, macOS, or Linux):

```bash
npm run electron:build
```
The output files will be generated in the `release` directory.

### Build Output

After building, you can find the executable in:
- **Unpacked (Portable)**: `release/win-unpacked/ResearchLens AI.exe`
- **Installers**: (If configured) will also appear in the `release/` root folder.

## ⚙️ Configuration

1. **API Key**: On first launch, click the **Settings** (gear icon) in the sidebar. Enter your Google Gemini API Key.
2. **Model Selection**: You can also select which Gemini model version to use for analysis in the settings.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)