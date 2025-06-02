const MessageBoxLoading = () => {
  return (
    <div className="flex flex-col space-y-4 w-full lg:w-9/12">
      {/* Sources skeleton */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 dark:from-blue-700 dark:via-blue-600 dark:to-blue-700 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-light-100 dark:bg-dark-100 rounded-lg p-3 animate-pulse">
              <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded mb-2" style={{ animationDelay: `${i * 0.1}s` }} />
              <div className="h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-2/3" style={{ animationDelay: `${i * 0.15}s` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Answer skeleton */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-gradient-to-r from-green-200 via-green-300 to-green-200 dark:from-green-700 dark:via-green-600 dark:to-green-700 rounded animate-spin" />
          <div className="h-4 w-14 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-pulse" />
        </div>
        
        {/* Multiple paragraph skeleton */}
        <div className="space-y-3">
          {/* First paragraph */}
          <div className="space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-full animate-pulse" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-11/12 animate-pulse" style={{ animationDelay: '0.1s' }} />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-9/12 animate-pulse" style={{ animationDelay: '0.2s' }} />
          </div>
          
          {/* Second paragraph */}
          <div className="space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-10/12 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-8/12 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>

          {/* Third paragraph */}
          <div className="space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-full animate-pulse" style={{ animationDelay: '0.6s' }} />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-7/12 animate-pulse" style={{ animationDelay: '0.7s' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBoxLoading;
