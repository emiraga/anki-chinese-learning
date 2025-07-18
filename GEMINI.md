# Gemini Code Assistant Project Overview

This document provides a comprehensive overview of the `anki-chinese-learning` project, designed to assist the Gemini code assistant in understanding the project's structure, technologies, and key components.

## Project Description

`anki-chinese-learning` is a full-stack web application that serves as a companion tool for learning Mandarin Chinese with Anki. It provides various features to help users study characters, phrases, pinyin, and more. The application interacts with the Anki desktop application via the AnkiConnect extension.

## Core Technologies

- **Frontend:**
    - **Framework:** [React](https://react.dev/) with [React Router](https://reactrouter.com/) for routing and server-side rendering.
    - **Language:** [TypeScript](https://www.typescriptlang.org/)
    - **Styling:** [Tailwind CSS](https://tailwindcss.com/)
    - **Build Tool:** [Vite](https://vitejs.dev/)
- **Backend:**
    - **Framework:** [React Router](https://reactrouter.com/) server
    - **Language:** [TypeScript](https://www.typescriptlang.org/)
    - **Environment:** [Node.js](https://nodejs.org/)

## Key Dependencies

- **`@react-router/dev`**: Development tools for React Router.
- **`@google/generative-ai`**: Google Generative AI client library.
- **`pinyin`**: A library for converting Chinese characters to Pinyin.
- **`yanki-connect`**: A client for the AnkiConnect addon, enabling communication with the Anki desktop application.
- **`tailwindcss`**: A utility-first CSS framework for styling.

A full list of dependencies can be found in the `package.json` file.

## Project Structure

The project is organized into the following main directories:

- **`app/`**: Contains the core application source code.
    - **`apis/`**: Modules for interacting with external APIs like AnkiConnect, Google Generative AI, and Claude.
    - **`components/`**: Reusable React components used throughout the application.
    - **`data/`**: Data fetching logic, type definitions, and static data.
    - **`routes/`**: Route components that define the different pages of the application.
    - **`root.tsx`**: The main application component, which sets up the layout and global context.
    - **`routes.ts`**: The main route configuration file for React Router.
- **`public/`**: Static assets that are served directly by the web server.
- **`utils/`**: Utility scripts and modules.

## Getting Started & Key Commands

The following commands are defined in `package.json` and are essential for working with this project:

- **`npm install`**: Installs all project dependencies.
- **`npm run dev`**: Starts the development server with Hot Module Replacement (HMR) at `http://localhost:5173`.
- **`npm run build`**: Compiles the TypeScript code and bundles the application for production.
- **`npm run start`**: Starts the production server.
- **`npm run typecheck`**: Runs the TypeScript compiler to check for type errors.
- **`npm run lint`**: Lints the codebase for style and quality issues using ESLint.

## Application Flow & Data

The application's main entry point is `app/root.tsx`. This file sets up the main layout and fetches initial data using custom hooks from the `app/data/` directory (`useAnkiProps`, `useAnkiPhrases`, `useAnkiCharacters`). This data is then passed down to the various route components using React Router's `Outlet` context.

Routing is defined in `app/routes.ts`, which maps URL paths to specific React components in the `app/routes/` directory.

## APIs and External Services

The application communicates with the following external services:

- **AnkiConnect**: The primary interface for interacting with the user's Anki collection. The API client is located in `app/apis/anki.ts`.
- **Google Generative AI**: Used for generative AI features. The client is in `app/apis/google_genai.ts`.
- **Claude**: Potentially used for generative AI features. The client is in `app/apis/claude.ts`.

Before running the application, ensure that Anki is running with the AnkiConnect extension installed and properly configured to accept requests from `http://localhost:5173`.
