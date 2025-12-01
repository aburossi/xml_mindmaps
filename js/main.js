document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION ---
    const container = d3.select('#chart-container');
    const tooltip = d3.select('.tooltip');
    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const duration = 500;
    let i = 0;
    let root;

    // --- 2. URL PARAMETER HANDLING ---
    const urlParams = new URLSearchParams(window.location.search);
    // Default to 'Steuern_in_der_Schweiz' if no ?map= parameter is present
    const mapName = urlParams.get('map') || 'Steuern_in_der_Schweiz';
    const dataUrl = `data/${mapName}.json`;

    // --- 3. SVG SETUP ---
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid slice');

    const g = svg.append('g');

    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);

    // --- 4. DATA LOADING ---
    d3.json(dataUrl).then(data => {
        d3.select('#loading-message').style('display', 'none');
        d3.select('#map-title').text(data.name.replace(/_/g, ' '));

        root = d3.hierarchy(data);
        root.x0 = height / 2;
        root.y0 = width / 2;

        // Initial Collapse: Keep root and 1st generation open, collapse the rest
        if (root.children) {
            root.children.forEach(collapseChildren);
        }

        update(root);
        centerNode(root);
    }).catch(err => {
        console.error(err);
        d3.select('#loading-message').text(`Error loading: ${dataUrl}`);
    });

    // --- 5. HELPER FUNCTIONS ---
    function collapseChildren(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapseChildren);
            d.children = null;
        }
    }

    function expandChildren(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(expandChildren);
            d._children = null;
        }
    }

    function centerNode(source) {
        const scale = d3.zoomTransform(svg.node()).k;
        const x = -source.y0 * scale + width / 2;
        const y = -source.x0 * scale + height / 2;
        svg.transition().duration(duration).call(
            zoom.transform, 
            d3.zoomIdentity.translate(x, y).scale(scale)
        );
    }

    // --- 6. UPDATE FUNCTION (The Core) ---
    function update(source) {
        const treeLayout = d3.tree().nodeSize([60, 250]); // [Height, Width] between nodes
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // --- NODES ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        // Enter
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', click)
            .on('mouseover', showTooltip)
            .on('mouseout', hideTooltip);

        // Node Rectangle
        nodeEnter.append('rect')
            .attr('width', 180)
            .attr('height', 50)
            .attr('x', -90)
            .attr('y', -25)
            .attr('rx', 6)
            .attr('ry', 6);

        // Node Text (ForeignObject for wrapping)
        nodeEnter.append('foreignObject')
            .attr('width', 170)
            .attr('height', 46)
            .attr('x', -85)
            .attr('y', -23)
            .append('xhtml:div')
            .html(d => d.data.name);

        // Update
        const nodeUpdate = nodeEnter.merge(node);
        
        nodeUpdate.transition().duration(duration)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('rect')
            .attr('class', d => d._children ? 'collapsed' : '')
            .style('fill', d => d._children ? '#238636' : '#1f2428'); // Visual cue for collapsed

        // Exit
        const nodeExit = node.exit().transition().duration(duration)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

        // --- LINKS ---
        const link = g.selectAll('path.link')
            .data(links, d => d.target.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);
        linkUpdate.transition().duration(duration)
            .attr('d', d => diagonal(d.source, d.target));

        link.exit().transition().duration(duration)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        // Store old positions
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // --- 7. INTERACTION HANDLERS ---
    function click(event, d) {
        // If there is a link, open it (optional logic)
        if (d.data.link && d.data.link.trim() !== "") {
            window.open(d.data.link, '_blank');
            return; 
        }

        // Otherwise toggle children
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
        centerNode(d);
    }

    function showTooltip(event, d) {
        // Only show if description exists and is not empty
        if (d.data.description && d.data.description.trim() !== "") {
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`<strong>${d.data.name}</strong>${d.data.description}`)
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        }
    }

    function hideTooltip() {
        tooltip.transition().duration(500).style('opacity', 0);
    }

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    // --- 8. BUTTON CONTROLS ---
    d3.select('#reset-zoom').on('click', () => centerNode(root));
    
    d3.select('#expand-all').on('click', () => {
        if(root._children) { root.children = root._children; root._children = null; }
        root.descendants().forEach(expandChildren);
        update(root);
        centerNode(root);
    });

    d3.select('#collapse-all').on('click', () => {
        root.children.forEach(collapseChildren);
        update(root);
        centerNode(root);
    });
});
