import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// MoreResources has been merged into the Resources page as the "External Resources" tab.
// This component redirects legacy /more-resources URLs automatically.
const MoreResources = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/resources?tab=external", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm">
      Redirecting to Resources → External Platforms…
    </div>
  );
};

export default MoreResources;
