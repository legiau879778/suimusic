# Project Copyright Next.js

# SuiMusic – Blockchain Music Copyright Platform

SuiMusic is a **Web3-based music copyright registration and management platform** built on the **Sui blockchain**.  
The project enables artists to **secure ownership of their music**, **mint NFTs**, and **manage licensing and verification** through transparent on-chain mechanisms.

---

## Overview

In the digital era, music creators face challenges in proving ownership, protecting copyright, and managing distribution.  
**SuiMusic** addresses these issues by combining **blockchain technology**, **NFTs**, and a **modern web interface** to create a trusted and decentralized copyright registry for music works.

---

## Key Features

### Music Copyright Registration
- Register original music works on-chain
- Immutable proof of authorship and timestamp
- Transparent and verifiable ownership records

### NFT Minting & Ownership
- Each music work can be linked to an NFT
- Ownership and transfers are handled by Sui Move smart contracts
- Supports future extensions for resale and licensing

### Artist Profiles
- Public artist profiles with verified works
- Display metadata such as title, genre, language, and duration
- Wallet-based identity using Sui addresses

### Advanced Search & Filtering
- Search works by title, author, or content
- Filter by genre (Pop, Rock, Hip-Hop, Electronic, etc.)
- Filter by language and sale type
- Sort by newest, oldest, or popularity

### On-chain Verification
- Anyone can verify:
  - Author
  - Ownership
  - Registration time
- Eliminates disputes and fake claims

### AI-Powered Music Generation
- Generate creative song lyrics using OpenAI GPT-4
- Support for multiple genres and languages
- Integrated with the music copyright registration workflow

### Modern Web Interface
- Built with **Next.js + TypeScript**
- Responsive, fast, and user-friendly UI
- Integrated Web3 wallet connection

---

## Architecture

### Frontend
- **Next.js (App Router)**
- **React + TypeScript**
- CSS Modules for scoped styling
- Deployed on **Vercel**

### Blockchain
- **Sui Blockchain**
- **Move smart contracts**
- NFT minting & copyright registry logic

### Smart Contract Modules
- `chainstorm_nft/` – NFT and on-chain asset logic
- `contracts/` – Core copyright and registry contracts

---

## Tech Stack

| Layer | Technology |
|------|-----------|
| Frontend | Next.js, React, TypeScript |
| Styling | CSS Modules |
| Blockchain | Sui, Move |
| Web3 | Sui Wallet / dApp Kit |
| Deployment | Vercel |

---

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd suimusic
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # OpenAI API Key for AI music generation
   OPENAI_API_KEY=sk-REPLACE_ME
   
   # Other environment variables (Firebase, etc.)
   # ... existing env vars
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

---

## Project Structure

```text
suimusic/
├── src/                # Next.js frontend source
│   ├── app/            # App router pages
│   ├── components/     # UI components
│   ├── lib/            # Stores & helpers
│   └── styles/         # CSS modules
├── chainstorm_nft/     # Sui Move NFT modules
├── contracts/          # Smart contracts
├── data/               # Metadata / seed data
├── package.json
└── next.config.ts

