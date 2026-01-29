export const getTrailImage = (item) => {
    if (item.images && item.images.length > 0) return item.images[0];
    if (item.image) return item.image;

    // Fallback images (high quality hiking/nature)
    const fallbacks = [
        'https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2071&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1472396961693-142e6e269027?q=80&w=2104&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1501555088652-021faa106b9b?q=80&w=2073&auto=format&fit=crop'
    ];

    // Simple hash based on name to keep it consistent for the same trail
    const name = item.name || 'trail';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % fallbacks.length;

    return fallbacks[index];
};
