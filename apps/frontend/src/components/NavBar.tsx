const NavBar = () => {
  return (
    <div className="bg-white shadow-xs border-b border-gray-200">
      <div className="flex justify-between items-center p-4 mx-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            LivePoll
          </h1>
          <p className="text-sm font-medium text-neutral-500 tracking-tight">
            Real-time polling platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default NavBar;