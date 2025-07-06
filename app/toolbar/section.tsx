const Section: React.FC<{
  className?: string;
  loading?: boolean;
  error?: Error;
  children: React.ReactNode;
}> = ({ className, loading, error, children }) => {
  if (error) {
    return (
      <section className="pt-4 pb-4 text-center">
        Error: {error.name} {error.message}
      </section>
    );
  }

  if (loading) {
    return (
      <section className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center min-h-40">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-lg">Loading data...</p>
      </section>
    );
  }

  return <section className={className}>{children}</section>;
};

export default Section;
