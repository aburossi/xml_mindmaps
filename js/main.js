document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SETUP & DIMENSIONS ---
    const container = d3.select('#chart-container');
    const width = window.innerWidth;
    const height = window.innerHeight;
    let i = 0; // A counter to give nodes a unique ID if they don't have one
    const duration = 750; // Transition duration
    let root; // To store the root of the hierarchy

    // Create the SVG element
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`);

    // Create a group element to hold the mindmap, which we will zoom/pan
    const g = svg.append('g');

    // --- 2. ZOOM & PAN BEHAVIOR ---
    const zoom = d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // --- 3. DATA LOADING & TRANSFORMATION ---
    d3.xml('data/mindmap.xml')
        .then(data => {
            d3.select('#loading-message').style('display', 'none');
            const xmlRoot = data.querySelector('mindmap > node');

            // Recursive function to transform XML nodes
            function xmlToHierarchy(xmlNode) {
                const children = Array.from(xmlNode.children).map(child => xmlToHierarchy(child));
                return {
                    id: xmlNode.getAttribute('id'), // Use the ID from XML
                    name: xmlNode.getAttribute('text'),
                    children: children.length ? children : null
                };
            }

            const hierarchyData = xmlToHierarchy(xmlRoot);
            root = d3.hierarchy(hierarchyData);
            root.x0 = height / 2;
            root.y0 = 0;

            // Initially collapse all nodes except the first level
            root.children.forEach(collapse);

            update(root);
        })
        .catch(error => {
            console.error('Error loading or parsing XML:', error);
            d3.select('#loading-message').text('Failed to load mindmap data.');
        });

    // --- 4. CORE INTERACTIVE FUNCTIONS ---

    // Collapse function
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    // Click handler to toggle children
    function click(event, d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }

    // The main update function
    function update(source) {
        // Assigns the x and y position for the nodes
        const treeLayout = d3.tree().size([height - 100, width - 200]);
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Normalize for fixed-depth
        nodes.forEach(d => { d.y = d.depth * 250; });

        // --- NODES UPDATE ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter().append('g')
            .attr('class', d => 'node' + (d._children || d.children ? '' : ' leaf'))
            .attr('transform', d => `translate(${source.y0}, ${source.x0})`)
            .on('click', click);

        nodeEnter.append('circle')
            .attr('r', 1e-6); // Start with a radius of 0 for animation

        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.name);

        // Transition nodes to their new position.
        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('transform', d => `translate(${d.y}, ${d.x})`);

        // Update the node attributes and style
        nodeUpdate.select('circle')
            .attr('r', 8)
            .style('fill', d => d._children ? '#ffc107' : '#fff') // Fill yellow if collapsed
            .attr('cursor', 'pointer');

        // Remove any exiting nodes
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.y}, ${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // --- LINKS UPDATE ---
        const link = g.selectAll('path.link')
            .data(links, d => d.target.id);

        // Enter any new links at the parent's previous position.
        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        // Transition links to their new position.
        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => diagonal(d.source, d.target));

        // Remove any exiting links
        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        // Store the old positions for transition.
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Creates a curved (diagonal) path from parent to the child nodes
    function diagonal(s, d) {
        const path = `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
        return path;
    }
});
