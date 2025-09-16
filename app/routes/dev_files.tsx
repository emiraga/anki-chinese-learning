// Handle development tool files (source maps, etc.)
// This prevents React Router from treating these as application routes

export default function DevFiles() {
  // Return a 404 response for development files
  throw new Response("Not Found", { status: 404 });
}