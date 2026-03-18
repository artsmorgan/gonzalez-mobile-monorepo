async function postToMainStructure() {
    // We are ready to post to main structure
    const cronSecret = process.env.CRON_SECRET;
    const serverURL = process.env.SERVER_URL;
  
    if (!cronSecret || !serverURL) {
      throw new Error(
        "CRON_SECRET or SERVER_URL environment variable are not set"
      );
    }
  
    const response = await fetch(
      `${serverURL}/api/dynamic-prisma/main-structure`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
      }
    );
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return await response.json();
  }
  
  export { postToMainStructure };