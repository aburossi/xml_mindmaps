document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SETUP & DIMENSIONS ---
    const container = d3.select('#chart-container');
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create the SVG element
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`);

    // Create a group element to hold the mindmap, which we will zoom/pan
    const g = svg.append('g');

    // --- 2. ZOOM & PAN BEHAVIOR ---
    const zoom = d3.zoom()
        .scaleExtent([0.2, 4]) // Min/max zoom levels
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // --- 3. DATA LOADING & TRANSFORMATION ---
    d3.xml('data/mindmap.xml')
        .then(data => {
            // Hide loading message
            d3.select('#loading-message').style('display', 'none');

            // Get the root node from the XML document
            const xmlRoot = data.querySelector('mindmap > node');

            // Recursive function to transform XML nodes into a D3-hierarchy-compatible format
            function xmlToHierarchy(xmlNode) {
                // D3 hierarchy expects children to be in an array named 'children'
                const children = Array.from(xmlNode.children).map(child => xmlToHierarchy(child));
                return {
                    name: xmlNode.getAttribute('text'),
                    children: children.length ? children : null // D3 treats null children as leaf nodes
                };
            }

            const hierarchyData = xmlToHierarchy(xmlRoot);
            
            // Create a D3 hierarchy object, which adds useful properties like depth, parent, etc.
            const root = d3.hierarchy(hierarchyData);

            // --- 4. LAYOUT ---
            // Use d3.tree for a classic tree layout
            const treeLayout = d3.tree()
                .size([height - 100, width - 200]); // [vertical extent, horizontal extent]

            // Calculate the layout (assigns x, y coordinates to each node)
            treeLayout(root);

            // --- 5. DRAWING (D3 General Update Pattern) ---
            
            // Draw the links (lines connecting nodes)
            g.selectAll('.link')
                .data(root.links())
                .join('path')
                .attr('class', 'link')
                .attr('d', d3.linkHorizontal()
                    .x(d => d.y + 100) // Use y for horizontal position and add padding
                    .y(d => d.x + 50)  // Use x for vertical position and add padding
                );

            // Draw the nodes (circles and text)
            const nodes = g.selectAll('.node')
                .data(root.descendants())
                .join('g')
                .attr('class', 'node')
                .attr('transform', d => `translate(${d.y + 100}, ${d.x + 50})`); // Position the group

            // Add circles to the node groups
            nodes.append('circle')
                .attr('r', 8);

            // Add text to the node groups
            nodes.append('text')
                .text(d => d.data.name)
                .attr('dy', -15) // Position text above the circle
                .style('text-anchor', 'middle');

        })
        .catch(error => {
            console.error('Error loading or parsing XML:', error);
            d3.select('#loading-message').text('Failed to load mindmap data. Please check the console.');
        });
});
