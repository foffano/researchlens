# ResearchLens AI

ResearchLens AI is a powerful desktop application designed to supercharge academic research. Built with **Electron** and **React**, it leverages Google's **Gemini AI** models to automatically analyze, summarize, and extract structured data from research papers (PDFs).

![ResearchLens AI](tela.png) 
*(Note: Replace with actual screenshot)*

## 🔬 Scientific Methodology & System Architecture

ResearchLens AI employs a systematic, multimodal approach to automated literature analysis, ensuring high fidelity in data extraction and synthesis. The system architecture is designed to minimize information loss by processing raw document data directly through large language models (LLMs).

### 1. Direct Multimodal Processing
Unlike traditional systems that rely on intermediate OCR (Optical Character Recognition) or text extraction libraries (which often lose formatting, tables, and non-linear text flow), ResearchLens AI utilizes **native multimodal capabilities**.
*   **Input Handling**: PDF documents are converted into Base64 encoded streams client-side using standard `FileReader` APIs.
*   **Zero-Loss Ingestion**: The raw PDF binary data is transmitted directly to the Google Gemini model (e.g., `gemini-1.5-flash`) via the `application/pdf` MIME type context. This allows the model to "see" the document layout, identifying headers, footnotes, and sidebars essentially as a human reader would.

### 2. Structured Extraction Protocol
To ensure scientific rigor and data consistency, the system implements a **Dual-Phase Dynamic Prompting** strategy enforced by a strict JSON schema:

#### Phase A: Bibliographic Metadata Extraction
Every document undergoes a mandatory extraction pass for core citation data. The model is instructed to identify and normalize:
*   **Citation Details**: Title, Author list, Publication Year, and DOI/URL.
*   **Taxonomy Classification**: The system classifies documents into one of 23 predefined academic categories (e.g., *Research articles, Review articles, Clinical Trials, Meta-analyses*), enabling precise filtering and bibliometrics.

#### Phase B: Targeted Semantic Analysis
The system performs extraction based on user-defined "Analysis Columns". Each column represents a specific research question or data point.
*   **Prompt Engineering**: Each active column (e.g., "Methods", "Results") generates a specific sub-instruction within the master prompt (e.g., *"Extract the methodology, study design, or datasets used"*).
*   **Schema Enforcement**: The output is constrained to a rigorous JSON structure defined via the Google GenAI SDK's `responseSchema`. This guarantees that fields like "Results" are returned as structured arrays or text strings, eliminating hallucinated formatting and facilitating CSV export.

### 3. Data Integrity & Persistence
*   **Atomic Analysis Units**: Each analysis is treated as an atomic transaction. Results are watermarked with the specific model version used (`_models` metadata), allowing researchers to track which generation of AI produced a specific insight.
*   **Local-First Persistence**: To maintain data sovereignty and privacy, all analysis results are serialized and stored locally in a `researchlens_data.json` file via Electron's IPC (Inter-Process Communication) layer. No document data is stored on external servers beyond the transient processing window of the API call.

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
