# V-JEPA2 Demo

Meta's Video Joint Embedding Predictive Architecture 2 model loader demo.

## Features

- Next.js frontend for model interaction
- Python backend for model loading
- Playwright MCP integration for automated testing

## Prerequisites

- Node.js 20+
- Python 3.8+
- Claude Code with MCP support

## Setup

### 1. Install Dependencies

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt  # Create this if needed
```

### 2. MCP Server Setup

This project includes Playwright MCP for automated browser testing. When you open this project in Claude Code, the MCP server will be automatically configured from `.claude/mcp.json`.

The Playwright MCP server will be installed automatically using `npx @playwright/mcp@latest` when needed.

## Running the Application

### Start Frontend
```bash
cd frontend
npm run dev
```
The frontend will be available at http://localhost:3000

### Start Backend
```bash
cd backend
python server.py
```
The backend will be available at http://localhost:8000

**Backend Features:**
- Real-time progress updates via Server-Sent Events (SSE)
- Multiple model variants support (ViT-Large, Huge, Giant)
- Automatic GPU detection and fallback to CPU
- Model loading progress tracking (downloading, loading weights, moving to GPU)

## Claude Code Integration

This project is optimized for use with Claude Code. The following features are pre-configured:

- **Playwright MCP**: Automated browser testing and interaction
- **Project Structure**: Organized for easy navigation and development

### Using Playwright MCP with Claude

Once the project is open in Claude Code, you can ask Claude to:
- Navigate to pages and interact with elements
- Take screenshots of the UI
- Test form submissions and user flows
- Verify page content and behavior

Example prompts:
```
"Open the frontend and click the Load Model button"
"Take a screenshot of the model loader page"
"Test the model selection workflow"
```

## Project Structure

```
v-jepa2-demo/
├── .claude/
│   └── mcp.json           # MCP server configuration
├── frontend/              # Next.js application
│   ├── src/
│   │   └── app/
│   │       └── page.tsx   # Main UI component
│   ├── public/
│   ├── .env.local         # Environment configuration
│   └── package.json
├── backend/               # FastAPI backend
│   └── server.py          # API server with SSE support
└── model/                 # Model loading scripts
    └── load_vjepa2.py     # V-JEPA2 model loader
```

## Development

The project uses:
- **Frontend**: Next.js 16.0.4, React 19, Tailwind CSS 4
- **Backend**: Python with Flask/FastAPI (TBD)
- **Testing**: Playwright MCP for browser automation

## Troubleshooting

### MCP Server Not Loading
If Claude Code doesn't automatically detect the Playwright MCP server:
1. Ensure you're in the project root directory
2. Restart Claude Code
3. Check that `.claude/mcp.json` exists
4. Run `claude mcp list` to verify the server is connected

### Port Already in Use
If port 3000 is already in use, Next.js will automatically use the next available port (e.g., 3001, 3002).

## License

[Add your license here]
