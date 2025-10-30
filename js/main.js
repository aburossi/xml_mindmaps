document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SETUP & CONFIGURATION ---
    const container = d3.select('#chart-container');
    const tooltip = d3.select('.tooltip');
    const controls = d3.select('.controls');

    const width = window.innerWidth;
    const height = window.innerHeight - 70; // Adjust for header

    let i = 0;
    const duration = 750;
    let root;
    const zoom = d3.zoom();

    // --- 2. SVG & ZOOM SETUP ---
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`);

    // Define gradients for nodes
    const defs = svg.append('defs');
    const gradients = ['#58a6ff', '#a371f7', '#ffa657', '#7ee787', '#ff7b72'];
    gradients.forEach((color, i) => {
        const gradient = defs.append('linearGradient')
            .attr('id', `node-gradient-${i}`)
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '100%').attr('y2', '100%');
        gradient.append('stop').attr('offset', '0%').style('stop-color', color).style('stop-opacity', 0.8);
        gradient.append('stop').attr('offset', '100%').style('stop-color', color).style('stop-opacity', 0.4);
    });

    const g = svg.append('g');

    zoom.scaleExtent([0.3, 3]).on('zoom', (event) => {
        g.attr('transform', event.transform);
    });
    svg.call(zoom);

    // --- 3. DATA LOADING & INITIAL RENDER ---
    d3.xml('data/mindmap.xml')
        .then(data => {
            d3.select('#loading-message').style('display', 'none');
            const xmlRoot = data.querySelector('mindmap > node');

            function xmlToHierarchy(xmlNode) {
                const children = Array.from(xmlNode.children).map(child => xmlToHierarchy(child));
                return {
                    id: xmlNode.getAttribute('id'),
                    name: xmlNode.getAttribute('text'),
                    children: children.length ? children : null
                };
            }

            const hierarchyData = xmlToHierarchy(xmlRoot);
            root = d3.hierarchy(hierarchyData);
            root.x0 = height / 2;
            root.y0 = width / 2; // Center the root

            // Initial state: collapse all but the first level
            root.children.forEach(collapse);
            update(root);
            centerNode(root); // Center the view on the root initially
        })
        .catch(error => {
            console.error('Error loading or parsing XML:', error);
            d3.select('#loading-message').text('Failed to load mindmap data.');
        });

    // --- 4. UI CONTROLS ---
    controls.select('#reset-zoom').on('click', () => {
        centerNode(root);
    });
    
    controls.select('#expand-all').on('click', () => {
        expand(root);
        update(root);
        centerNode(root);
    });

    // --- 5. CORE INTERACTIVE FUNCTIONS ---
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    function expand(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(expand);
            d._children = null;
        }
    }

    function click(event, d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
        centerNode(d); // Focus and zoom on the clicked node
    }

    function centerNode(source) {
        const scale = zoom.scaleExtent()[1]; // Zoom in
        const translate = [width / 2 - source.y0 * scale, height / 2 - source.x0 * scale];
        svg.transition().duration(duration).call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }

    // --- 6. MAIN UPDATE FUNCTION ---
    function update(source) {
        // Use a tree layout for a top-down structure
        const treeLayout = d3.tree().size([height - 100, width - 400]);
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Normalize for fixed-depth
        nodes.forEach(d => { d.y = d.depth * 250; });

        // --- NODES UPDATE ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', d => 'node' + (d._children ? ' collapsed' : ''))
            .attr('transform', d => `translate(${source.y0}, ${source.x0})`)
            .on('click', click);

        // Use foreignObject to render HTML inside SVG
        nodeEnter.append('foreignObject')
            .attr('width', 180)
            .attr('height', 50)
            .attr('x', -90) // Center the foreignObject
            .attr('y', -25)
            .append('xhtml:div')
            .attr('class', 'node-text-content')
            .html(d => d.data.name);

        // Transition nodes to their new position.
        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('transform', d => `translate(${d.y}, ${d.x})`)
            .attr('class', d => 'node' + (d._children ? ' collapsed' : ''));

        // Remove any exiting nodes
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.y}, ${source.x})`)
            .remove();

        // --- LINKS UPDATE ---
        const link = g.selectAll('path.link')
            .data(links, d => d.target.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => diagonal(d.source, d.target));

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
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }
});
