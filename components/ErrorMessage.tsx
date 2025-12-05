import React from 'react';

interface Props {
  message: string;
  onRetry: () => void;
}

const ErrorMessage: React.FC<Props> = ({ message, onRetry }) => {
  return (
    <div role="alert" className="w-full max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <div className="text-red-600 text-4xl mb-4" aria-hidden="true">⚠️</div>
      <h3 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h3>
      <p className="text-red-800 mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="bg-red-700 text-white px-6 py-2 rounded-lg hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
};

export default ErrorMessage;