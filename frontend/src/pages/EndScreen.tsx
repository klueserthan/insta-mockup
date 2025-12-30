import { useState, useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';

export default function EndScreen() {
  const [, params] = useRoute('/end/:publicUrl');
  const publicUrl = params?.publicUrl;
  
  const searchParams = new URLSearchParams(window.location.search);
  const message = searchParams.get('message') || 'Thank you for participating in this study.';
  const redirectUrl = searchParams.get('redirect') || '';
  const originalParamsString = searchParams.get('_originalParams') || '';
  
  const [countdown, setCountdown] = useState(10);
  
  const finalRedirectUrl = useMemo(() => {
    if (!redirectUrl) return '';
    
    try {
      // Start with the redirect base URL
      const redirectBase = new URL(redirectUrl);
      
      // Forward original parameters from the feed URL (US4: preserve all tracking params)
      if (originalParamsString) {
        const originalParams = new URLSearchParams(originalParamsString);
        originalParams.forEach((value, key) => {
          redirectBase.searchParams.set(key, value);
        });
      }
      
      return redirectBase.toString();
    } catch (error) {
      // Handle invalid redirect URL gracefully
      console.error('Invalid redirect URL:', redirectUrl, error);
      return '';
    }
  }, [redirectUrl, originalParamsString]);

  useEffect(() => {
    if (!redirectUrl) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = finalRedirectUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [redirectUrl, finalRedirectUrl]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6" data-testid="end-screen-container">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#E4405F] to-[#833AB4] rounded-full mx-auto mb-6 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white text-lg leading-relaxed whitespace-pre-wrap" data-testid="text-end-message">
            {message}
          </p>
        </div>
        
        {redirectUrl && (
          <div className="mt-8 space-y-4">
            <a 
              href={finalRedirectUrl}
              className="inline-block px-6 py-3 bg-gradient-to-r from-[#E4405F] to-[#833AB4] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              data-testid="link-redirect"
            >
              Continue to Survey
            </a>
            <p className="text-gray-400 text-sm" data-testid="text-countdown">
              Redirecting automatically in {countdown} seconds...
            </p>
            <p className="text-gray-500 text-xs break-all" data-testid="text-redirect-url">
              {redirectUrl}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
