<div align="center">

  <img src="./logo.png" alt="LEX-IA Logo" width="180" style="margin-bottom: 20px;">

  # ⚖️ LEX-IA / WafabAI
  ### *Intelligent Legal Assistant & RAG-Powered Semantic Search for Moroccan Law*

  [![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
  [![Flask](https://img.shields.io/badge/Flask-3.1.1-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
  [![Angular](https://img.shields.io/badge/Angular-17.3-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
  [![LangChain](https://img.shields.io/badge/LangChain-0.3.27-1C3C3C?style=for-the-badge&logo=chainlink&logoColor=white)](https://www.langchain.com/)
  [![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-FF6F61?style=for-the-badge&logo=databricks&logoColor=white)](https://www.trychroma.com/)
  [![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
  [![License](https://img.shields.io/badge/License-Academic_/_Doctorat-blue?style=for-the-badge)](./LICENSE)

  <p align="center">
    <a href="#-about-the-project">About</a> •
    <a href="#-key-features">Key Features</a> •
    <a href="#-system-architecture">Architecture</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-vector-collections">Vector Collections</a>
  </p>

</div>

---

## 📌 About The Project

**LEX-IA** (also referred to as **WafabAI**) is an enterprise-grade AI-powered legal assistant and semantic search engine specifically designed for **Moroccan Law** (*Code du Travail, Code Commerce, Code Pénal, Dahirs, Bulletins Officiels, and Case Law Jurisprudence*).

By combining **Retrieval-Augmented Generation (RAG)** with high-performance vector databases (**ChromaDB**) and advanced language models, LEX-IA empowers legal professionals, researchers, and organizations to query, search, and analyze complex legal frameworks in natural language with high contextual accuracy and source attribution.

---

## ✨ Key Features

- 🧠 **Retrieval-Augmented Generation (RAG)**
  - Answers complex legal questions grounded strictly in official Moroccan legislation.
  - Multi-model embedding support using `sentence-transformers/all-MiniLM-L6-v2` and `google/embeddinggemma-300m`.

- 🔍 **Hybrid & Semantic Legal Search**
  - Ultra-fast semantic vector search across indexed legal documents, Dahirs, and codes.
  - Grouping and chunk-level metadata retrieval for precise article matching.

- 📜 **Jurisprudence Workflow Engine**
  - Dedicated validation pipeline allowing legal experts (*Responsables juridiques*) to submit, review, verify, and index landmark court rulings and legal precedents.

- 🛡️ **Role-Based Access Control (RBAC)**
  - **Administrateur**: Complete system oversight, user management, and vector collection maintenance.
  - **Responsable juridique**: Legal validation, jurisprudence moderation, and domain indexing.
  - **Utilisateur**: Standard legal query execution, search, and document consultation.

- 📊 **Real-Time Analytics Dashboard**
  - Interactive dashboard metrics monitoring total indexed documents, active vector collections, user activity, and system query performance.

- ⚙️ **Dynamic LLM Engine Manager**
  - Modular backend allowing administrators to configure, switch default LLM models, and customize legal system prompts on the fly.

- 🔐 **Enterprise Security & Authentication**
  - JWT Access & Refresh Tokens (`Flask-JWT-Extended`) with token revocation blocklisting.
  - Password hashing with `Bcrypt`.
  - OTP-based password recovery via email service (`Flask-Mail`).

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Client ["Client Layer (Angular 17)"]
        UI["Angular SPA Frontend"]
        AuthComp["Auth & RBAC Guards"]
        SearchUI["Legal Search & RAG Chat UI"]
        DashUI["Analytics & Admin Dashboard"]
    end

    subgraph Backend ["Backend API Layer (Flask 3.1)"]
        API["Flask REST Blueprints"]
        JWT["JWT Auth & Revocation Blocklist"]
        RAGService["LangChain RAG Pipeline"]
        DocService["Document & Parser Manager"]
        JurisService["Jurisprudence Engine"]
    end

    subgraph Storage ["Data & AI Storage Layer"]
        MySQL[("MySQL RDBMS\n(loimaroc.sql)")]
        ChromaDB[("ChromaDB Vector Store\n(chroma_storage)")]
        HFModels["HuggingFace Embeddings\n(MiniLM / Gemma)"]
    end

    UI -->|HTTP / JSON REST API| API
    API --> JWT
    API --> MySQL
    RAGService --> HFModels
    RAGService --> ChromaDB
    DocService --> ChromaDB
    DocService --> MySQL
    JurisService --> MySQL
```

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | [Angular 17](https://angular.io/) | Reactive web UI with TypeScript, RxJS, and modular components |
| **Backend Framework** | [Flask 3.1](https://flask.palletsprojects.com/) | Lightweight RESTful Python API framework |
| **Orchestration & RAG** | [LangChain](https://www.langchain.com/) | LLM pipeline, prompt management, and document retrieval |
| **Vector Database** | [ChromaDB](https://www.trychroma.com/) | Embedded high-dimensional vector store for legal document embeddings |
| **Embeddings** | [HuggingFace Transformers](https://huggingface.co/) | `all-MiniLM-L6-v2` & `google/embeddinggemma-300m` |
| **Relational Database** | [MySQL 8.0](https://www.mysql.com/) | User management, roles, document metadata, OTPs, and jurisprudence |
| **ORM & DB Tools** | [SQLAlchemy 3.1](https://www.sqlalchemy.org/) & PyMySQL | Database mapping and migration handling |
| **Security & Auth** | [Flask-JWT-Extended](https://flask-jwt-extended.readthedocs.io/) & [Bcrypt](https://flask-bcrypt.readthedocs.io/) | Token-based auth, refresh tokens, and password hashing |

---

## 📂 Project Structure

```text
lex-ia/
├── app/                         # Flask Backend Application
│   ├── config/                  # Global configuration (JWT, Mail, Vector directories)
│   ├── models/                  # SQLAlchemy Data Models (User, Role, VectorCollection, etc.)
│   ├── repository/              # Data Access Layer
│   ├── routes/                  # Route Definitions
│   ├── service/                 # Business Logic & RAG Pipelines
│   ├── utils/                   # Helpers (Extensions, Chroma Client Manager)
│   ├── webservice/               # REST API Endpoints (Blueprints)
│   │   ├── authws.py            # Authentication & OTP Endpoints
│   │   ├── dashboard_ws.py      # Analytics & System Statistics
│   │   ├── documentsws.py       # Document Parsing & Vector Indexing
│   │   ├── jurisprudence_ws.py  # Court Rulings & Jurisprudence Workflow
│   │   ├── llm_model_ws.py      # LLM Management & System Prompts
│   │   ├── questionsws.py       # Legal RAG Q&A Processing
│   │   ├── recherchews.py       # Hybrid & Vector Search Service
│   │   └── userws.py            # User Management (RBAC)
│   ├── chroma_storage/          # ChromaDB Persistent Storage Directory
│   ├── database.yaml            # MySQL Database Connection URI Config
│   ├── main.py                  # Application Entry Point & Initialization
│   └── requirements.txt         # Python Package Dependencies
│
├── frontend/                    # Angular 17 Single Page Application
│   ├── src/                     # Angular Source Code (Components, Services, Guards)
│   ├── angular.json             # Angular Workspace Configuration
│   └── package.json             # Node Dependencies & Build Scripts
│
├── prompts/                     # Legal System Prompts & Conceptual Guides
├── loimaroc.sql                 # Initial SQL Database Dump (Moroccan Law Schema)
├── logo.png                     # Official Logo Asset
└── README.md                    # Project Documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your environment:
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or `20.x` (with `npm` or `@angular/cli`)
- **MySQL Database Server**: `8.0` or higher

---

### 1. Database Setup

1. Create a MySQL database named `loimaroc`:
   ```sql
   CREATE DATABASE loimaroc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Import the provided SQL schema dump:
   ```bash
   mysql -u root -p loimaroc < loimaroc.sql
   ```
3. Configure your connection in `app/database.yaml`:
   ```yaml
   uri: "mysql+mysqlconnector://root:YOUR_PASSWORD@localhost:3306/loimaroc"
   ```

---

### 2. Backend Installation (Flask)

1. Navigate to the backend directory:
   ```bash
   cd app
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Launch the Flask API server:
   ```bash
   python main.py
   ```
   *The server will start at `http://localhost:5000` and automatically initialize default roles, test users, and ChromaDB collections.*

---

### 3. Frontend Installation (Angular)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```
4. Access the web interface at `http://localhost:4200/`.

---

## 🔑 Default Accounts for Testing

Upon initial launch, the system automatically seeds default accounts for development:

| Role | Username / Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `admin@example.com` | `admin123` | Full system administration, user management, vector config |
| **Responsable juridique** | `juriste@example.com` | `legal123` | Jurisprudence validation, legal document review |
| **Utilisateur** | `user@example.com` | `user123` | Legal Q&A, semantic search, document consultation |

---

## 📡 API Reference Overview

| Blueprint Base URL | Description | Key Endpoints |
| :--- | :--- | :--- |
| `/api/auth` | User Auth & Profile | `POST /login`, `POST /register`, `POST /logout`, `POST /forgot-password` |
| `/api/question` | RAG Legal Q&A Engine | `POST /ask` |
| `/api/recherche` | Semantic Vector Search | `POST /query`, `GET /search` |
| `/api/documents` | Legal Documents & Indexing | `GET /`, `POST /upload`, `POST /index` |
| `/api/jurisprudence` | Case Law Validation Workflow | `GET /`, `POST /validate`, `POST /submit` |
| `/api/dashboard` | Analytics & Metrics | `GET /stats` |
| `/api/llm_models` | LLM Configuration & Prompts | `GET /`, `POST /select-default` |
| `/api/user` | User Management (Admin) | `GET /`, `PUT /:id/role`, `DELETE /:id` |

---

## 📦 Vector Collections

LEX-IA manages persistent vector spaces in ChromaDB for domain-specific retrieval:

1. `loi-maroc-2025` — Moroccan legal codes & Dahirs updated for 2025 (`sentence-transformers/all-MiniLM-L6-v2`).
2. `lex-ia-total` — Comprehensive unified knowledge index (`google/embeddinggemma-300m`).
3. `Jurispridance_marocaine` — Validated court decisions and jurisprudence precedents (`google/embeddinggemma-300m`).

---

## 📄 License & Acknowledgments

This project is developed as part of academic research (**Doctorat**).  
Special thanks to the open-source legal AI community, LangChain, HuggingFace, and ChromaDB teams.

<div align="center">
  <sub>Built with ❤️ for Legal Technology in Morocco.</sub>
</div>
