```tsx
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-between">
          <div className="w-full md:w-1/3 mb-4 md:mb-0">
            <h3 className="text-lg font-semibold mb-2">Company</h3>
            <ul className="space-y-1">
              <li>
                <a href="/about" className="text-gray-400 hover:text-white">
                  About Us
                </a>
              </li>
              <li>
                <a href="/contact" className="text-gray-400 hover:text-white">
                  Contact
                </a>
              </li>
              <li>
                <a href="/careers" className="text-gray-400 hover:text-white">
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div className="w-full md:w-1/3 mb-4 md:mb-0">
            <h3 className="text-lg font-semibold mb-2">Products</h3>
            <ul className="space-y-1">
              <li>
                <a href="/products" className="text-gray-400 hover:text-white">
                  Our Products
                </a>
              </li>
              <li>
                <a href="/pricing" className="text-gray-400 hover:text-white">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/docs" className="text-gray-400 hover:text-white">
                  Documentation
                </a>
              </li>
            </ul>
          </div>
          <div className="w-full md:w-1/3">
            <h3 className="text-lg font-semibold mb-2">Legal</h3>
            <ul className="space-y-1">
              <li>
                <a href="/terms" className="text-gray-400 hover:text-white">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-gray-400 hover:text-white">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>
        </div>
        <hr className="my-6 border-gray-700" />
        <div className="text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
```