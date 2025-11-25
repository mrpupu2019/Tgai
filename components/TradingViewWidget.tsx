import React from 'react';
import { TRADINGVIEW_EMBED_URL } from '../constants';

const TradingViewWidget: React.FC = () => {
  return (
    <div id="tradingview-widget-container" className="w-full h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600 z-10"></div>
      <iframe
        src={TRADINGVIEW_EMBED_URL}
        className="w-full h-full"
        frameBorder="0"
        allowFullScreen
        title="TradingView Chart"
        allow="cross-origin-isolated"
      />
      <div className="absolute bottom-4 right-4 bg-black/70 text-xs text-gray-400 px-2 py-1 rounded pointer-events-none backdrop-blur-sm">
        Source: TradingView
      </div>
    </div>
  );
};

export default TradingViewWidget;