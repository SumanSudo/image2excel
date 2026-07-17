# Image2Excel Master Blueprint & Execution Roadmap

This comprehensive blueprint outlines the architecture, data structures, and phased implementation strategy for **Image2Excel**, a fully offline, free, and local-first application designed to extract structured tabular data from images and export them into native Excel (`.xlsx`) spreadsheets.

---

## 1. System Architecture & Component Interactions

To ensure low latency and minimize memory overhead on a local machine, the application uses a decoupled microservices architecture inside a unified monorepo. Instead of serializing large binary images across HTTP payloads, the Node.js API and the Python OCR service share a local storage volume.

```
+-------------------------------------------------------------+
|                       Client Browser                        |
|  [Next.js App Router + TanStack Table + Shadcn UI Preview]  |
+------------------------------+------------------------------+
                               |
                               | (1) Uploads Image Multipart/Form-Data
                               v
+-------------------------------------------------------------+
|                     Node.js Express Server                  |
|  [Orchestrator, Input Validation, ExcelJS Grid Builder]     |
+------------------------------+------------------------------+
                               |
                               | (2) Saves file to shared disk /tmp
                               | (3) POST /api/v1/ocr { filename: "img.png" }
                               v
+-------------------------------------------------------------+
|                    Python FastAPI Worker                    |
|  [OpenCV Preprocessing + PaddleOCR / PP-Structure Engine]   |
+-------------------------------------------------------------+
```

### Data Workflow Dataflow
1. **Ingestion:** The user drops an image (`.png`, `.jpg`, `.jpeg`, `.webp`) into the React Dropzone interface.
2. **Buffering & Disk Transfer:** The Next.js client sends the image to the Node.js server via a multipart request. The Node server immediately streams it to a shared ephemeral directory (`/shared/storage/tmp`).
3. **Low-Overhead RPC:** The Node server triggers the Python FastAPI backend by sending a JSON payload containing only the metadata and the local filename.
4. **Computer Vision Pipeline:** 
   - The Python service reads the file from the local disk.
   - It runs OpenCV routines for deskewing, binarization, and noise reduction.
   - It passes the cleaned image to PaddleOCR (and PP-Structure for dense tables).
5. **Matrix Normalization:** The Python engine aggregates coordinates, clusters rows/columns using spatial tolerance algorithms, and maps text blocks to a rigid 2D JSON grid format.
6. **Preview & Interactivity:** The JSON grid returns to the frontend via the Node proxy, hydrating a TanStack Table instance where the user can manipulate cells, add/delete rows/columns, and leverage a history stack for undo/redo actions.
7. **Downstream Compilation:** When finalized, the edited grid state is posted to the ExcelJS compiler on the Node backend, which generates an optimized, auto-fitted binary `.xlsx` stream for immediate browser download.

---

## 2. Dynamic Directory Structure

```text
image2excel/
├── apps/
│   ├── web/                         # Next.js Frontend Application
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router (Layouts, Pages)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx         # Modern Minimalist Glassmorphism Home
│   │   │   │   └── workspace/       # OCR Workspace & Editable Grid
│   │   │   │       page.tsx
│   │   │   ├── components/          # UI Elements & Workspace Views
│   │   │   │   ├── ui/              # Radix UI wrapper via Shadcn UI
│   │   │   │   ├── Dropzone.tsx
│   │   │   │   ├── Spreadsheet.tsx  # Canvas/TanStack Table Workspace
│   │   │   │   └── TopBanner.tsx
│   │   │   ├── hooks/               # State Hooks (e.g., useSpreadsheetHistory)
│   │   │   ├── services/            # Client-side API fetch abstraction
│   │   │   ├── types/               # TypeScript structural boundaries
│   │   │   └── utils/               # Formatting, CSS merging (clsx/tailwind-merge)
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   │
│   └── server/                      # Node.js Express Orchestration Server
│       ├── src/
│       │   ├── controllers/         # Request handlers (Upload, Export, Process)
│       │   ├── middleware/          # File interceptors, Error handling, Zod boundaries
│       │   ├── routes/              # Explicit API routing definitions
│       │   ├── services/            # ExcelJS builder, Python IPC handlers
│       │   ├── types/
│       │   └── index.ts             # Server boots here
│       ├── tsconfig.json
│       └── package.json
│
├── services/
│   └── ocr/                         # Local Python 3.12 Engine
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py              # FastAPI application server entrypoint
│       │   ├── core/
│       │   │   ├── config.py
│       │   │   ├── ocr_engine.py    # PaddleOCR lifecycle manager
│       │   │   └── preprocessor.py  # OpenCV deskew, grayscale & thresholding
│       │   ├── utils/
│       │   │   └── spatial_cluster.py # Advanced X/Y grouping & table extraction
│       │   └── schemas/             # Pydantic data validation models
│       ├── Dockerfile
│       └── requirements.txt
│
├── shared/
│   └── storage/
│       └── tmp/                     # Fast-I/O ephemeral disk space shared by containers
│
├── docker/
│   ├── docker-compose.yml           # Local orchestrator orchestration schema
│   ├── frontend.Dockerfile
│   └── backend.Dockerfile
└── README.md
```

---

## 3. Core Engine Specification & Table Parsing Strategy

Scanned documents are almost never perfectly aligned. To ensure production-grade robustness without cloud dependency, the extraction engine uses spatial clustering.

### Step A: OpenCV Document Preprocessing
Before throwing raw pixels into PaddleOCR, images undergo strict structural normalization inside `services/ocr/app/core/preprocessor.py`:
1. **Grayscale Conversion:** Reduces memory depth and standardizes luminance channels.
2. **Deskewing via Radon Transform / Hough Lines:** Computes the global orientation slope of the text lines. The image is rotated counter-clockwise by the calculated angle to level the horizontal baselines.
3. **Adaptive Thresholding:** Binarizes the image using Gaussian methods to maximize high-frequency contrast between text ink and varying paper backgrounds.

### Step B: Spatial Clustering Algorithm
The layout engine uses dynamic tolerance clustering instead of literal matching:
1. **Bounding Box Collection:** PaddleOCR processes the image, outputting a list of bounding boxes: B_i = [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] accompanied by text and confidence metrics.
2. **Dynamic Baseline Estimation:** Bounding boxes are sorted by their center Y-coordinate.
3. **Row Clustering:** The algorithm steps through the sorted elements. A new row is instantiated when the vertical distance between adjacent blocks exceeds a dynamic constraint, computed as: Threshold = 0.5 * Average Box Height.
4. **Column Mapping:** Once rows are locked, the unique X-coordinates across all blocks are consolidated onto a global X-timeline. Intersecting spans are combined to establish rigid table column tracks.
5. **Grid Assembly:** A matrix structural object initialized as an empty 2D array is populated by mapping the assigned row and column indexes of individual components. Missing nodes are filled with blank placeholders to preserve matrix integrity.

---

## 4. API & Data Contract Documentation

### 1. Ingestion Request
- **Endpoint:** `POST /api/v1/ocr/upload`
- **Payload:** `multipart/form-data` (Key: `file`, Binary: Image)
- **Response Contracts (`201 Created`):**
```json
{
  "success": true,
  "message": "File written locally.",
  "data": {
    "fileId": "abc-123-xyz",
    "filename": "uploaded_invoice_90812.png",
    "mimeType": "image/png"
  }
}
```

### 2. Processing Handshake
- **Endpoint:** `POST /api/v1/ocr/process`
- **Payload (`application/json`):**
```json
{
  "fileId": "abc-123-xyz",
  "options": {
    "deskew": true,
    "highContrast": false
  }
}
```
- **Response Contracts (`200 OK`):**
```json
{
  "success": true,
  "matrix": [
    [
      { "text": "Item Name", "confidence": 0.99, "isHeader": true },
      { "text": "Quantity", "confidence": 0.98, "isHeader": true },
      { "text": "Price", "confidence": 0.97, "isHeader": true }
    ],
    [
      { "text": "Developer Workstation", "confidence": 0.95, "isHeader": false },
      { "text": "2", "confidence": 0.99, "isHeader": false },
      { "text": "$2,400.00", "confidence": 0.92, "isHeader": false }
    ]
  ]
}
```

### 3. Binary Compilation
- **Endpoint:** `POST /api/v1/excel/export`
- **Payload (`application/json`):** Holds the full interactive table matrix state as modified by the user.
- **Response Contracts (`200 OK`):** Streams binary data content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` containing the generated document.

---

## 5. UI/UX Design System Specification

The application employs a premium dark-mode-first aesthetic inspired by professional productivity suites.

### Color Palette Architecture
- **Deep Base Foundation (`Background`):** `#09090b` (Deep Slate Black)
- **Elevated Canvas Components (`Card / Muted Surface`):** `#18181b` (Carbon Charcoal)
- **Active Structural Boundaries (`Border Elements`):** `#27272a` (Subtle Slate Line)
- **Primary Operational Indicator (`Accent Callout`):** `#3b82f6` (Vibrant Cobalt Blue)
- **Text Layer Hierarchy:** `#f4f4f5` (True White for headers), `#a1a1aa` (Cool Muted Gray for descriptions)

### Workspace Layout & Interactions
- **The Glassmorphism Matrix:** The drag-and-drop workspace uses an interactive blur backdrop filter (`backdrop-blur-md`) with variable opacity layers (`bg-white/[0.02]`) highlighted by a linear gradient boundary stroke.
- **Spreadsheet Canvas UI:** Built over TanStack Table, rows show visual warning indicators (e.g., an amber background overlay) if a cell's underlying confidence property falls beneath a critical $75\%$ threshold. 
- **Keyboard Shortcut System:**
  - `Ctrl + Z` / `Ctrl + Y`: Step through the state undo/redo history stacks.
  - `Arrow Keys`: Move cursor focus linearly through the data grid cells.
  - `Tab` / `Enter`: Save current inputs and step to the adjacent horizontal or lower cell block.

---

## 6. Execution Roadmap & Phase Directives

To successfully compile this architecture without hitting LLM context limit truncations or encountering system bugs, follow this exact development sequence.

### Phase 1: Local Foundation & Ephemeral Storage
- Construct the base workspace monorepo structure.
- Configure root project structures, settings, and shared filesystem paths.
- Setup local Docker environments including networking loops and volume parameters.

### Phase 2: Python Computer Vision Service
- Build `services/ocr/app/main.py` using FastAPI.
- Write the CV processing pipeline in `preprocessor.py` using OpenCV.
- Implement the baseline row clustering metrics using numerical algorithms.

### Phase 3: Node.js Processing Proxy
- Build the initial Express project handling TypeScript parameters natively.
- Write standard file intake components saving data chunks out to the shared file path.
- Develop internal HTTP client frameworks talking downstream directly to the Python FastAPI process container.

### Phase 4: Frontend Workspace Interface
- Instantiate the Next.js workspace framework leveraging custom App Routing.
- Build the core interface matching specified Dark/Glassmorphism wireframes.
- Write the unified layout dropzone interface connecting directly to file collection services.

### Phase 5: The Interactive Grid Engine
- Connect TanStack Table to handle high-performance, real-time cell layout alterations.
- Implement the local state management pattern supporting atomic cell rollbacks.
- Write visual components showcasing confidence score callouts alongside validation warnings.

### Phase 6: Binary Compiler Production
- Implement ExcelJS formatting routines on the Node server.
- Apply structural styles, column autowidth calculation functions, and sheet header freezing rules.
- Run complete end-to-end processing loops verifying structural data conversion from image to final excel sheet download.
