document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION ---
    const container = d3.select('#chart-container');
    const modal = document.getElementById('info-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    
    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const duration = 500;
    let i = 0;
    let root;

    // Node Dimensions
    const nodeWidth = 220;
    const baseHeight = 60;

    // --- NEW: COLOR PALETTE ---
    // Blue, Purple, Orange, Green, Red, Cyan, Pink, Yellow
    const palette = [
        '#58a6ff', // Blue
        '#bc8cff', // Purple
        '#ffa657', // Orange
        '#7ee787', // Green
        '#ff7b72', // Red
        '#39c5cf', // Cyan
        '#ff9bce', // Pink
        '#d29922'  // Yellow
    ];

    // --- 2. URL PARAMETER HANDLING ---
    const urlParams = new URLSearchParams(window.location.search);
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

        // --- NEW: ASSIGN COLORS ---
        // 1. Root gets a neutral color (or white)
        root.data.color = '#c9d1d9'; 

        // 2. Assign palette colors to first generation and inherit down
        if (root.children) {
            root.children.forEach((child, index) => {
                // Cycle through palette
                const branchColor = palette[index % palette.length];
                assignColorRecursive(child, branchColor);
            });
        }

        // Initial Collapse
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
    
    // NEW: Recursive Color Assignment
    function assignColorRecursive(node, color) {
        node.data.color = color;
        if (node.children) {
            node.children.forEach(c => assignColorRecursive(c, color));
        }
        // Also handle hidden children if data was pre-collapsed (rare in this setup but good practice)
        if (node._children) {
            node._children.forEach(c => assignColorRecursive(c, color));
        }
    }

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

    function getNodeHeight(d) {
        const charsPerLine = 28; 
        const textLength = d.data.name.length;
        const lines = Math.ceil(textLength / charsPerLine);
        return Math.max(baseHeight, 20 + (lines * 18));
    }

    // --- 6. UPDATE FUNCTION ---
    function update(source) {
        const treeLayout = d3.tree().nodeSize([100, 300]); 
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // --- NODES ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', clickNode);

        // 1. Node Rectangle
        nodeEnter.append('rect')
            .attr('width', nodeWidth)
            .attr('rx', 6)
            .attr('ry', 6)
            .style('stroke-width', '1.5px'); // Moved stroke width here

        // 2. Node Text
        nodeEnter.append('foreignObject')
            .attr('width', nodeWidth - 35)
            .append('xhtml:div')
            .html(d => d.data.name);

        // 3. Icons
        const iconsGroup = nodeEnter.append('g').attr('class', 'icons-group');

        const linkIcon = iconsGroup.filter(d => d.data.link && d.data.link.trim() !== "")
            .append('g').attr('class', 'node-icon')
            .on('click', (event, d) => {
                event.stopPropagation();
                window.open(d.data.link, '_blank');
            });
        linkIcon.append('path')
            .attr('d', "M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z")
            .attr('transform', 'scale(0.8)');

        const infoIcon = iconsGroup.filter(d => d.data.description && d.data.description.trim() !== "")
            .append('g').attr('class', 'node-icon')
            .on('click', (event, d) => {
                event.stopPropagation();
                openModal(d.data.name, d.data.description);
            });
        infoIcon.append('path')
            .attr('d', "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z")
            .attr('transform', 'scale(0.8)');

        // --- UPDATE TRANSITIONS ---
        const nodeUpdate = nodeEnter.merge(node);
        
        nodeUpdate.transition().duration(duration)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        // --- NEW: APPLY DYNAMIC COLORS ---
        nodeUpdate.select('rect')
            .attr('height', d => getNodeHeight(d))
            .attr('y', d => -getNodeHeight(d) / 2)
            .attr('x', -nodeWidth / 2)
            .attr('class', d => d._children ? 'collapsed' : '')
            // Logic: 
            // 1. Stroke is always the branch color.
            // 2. If collapsed, Fill is the branch color.
            // 3. If expanded, Fill is dark (#1f2428).
            .style('stroke', d => d.data.color) 
            .style('fill', d => d._children ? d.data.color : '#1f2428');

        // Update Text Color (If collapsed and filled with bright color, maybe make text black? 
        // For now, keeping it white/grey usually works with these colors, but let's keep it standard)
        nodeUpdate.select('foreignObject')
            .attr('height', d => getNodeHeight(d))
            .attr('y', d => -getNodeHeight(d) / 2)
            .attr('x', (-nodeWidth / 2) + 5)
            .select('div')
            .style('color', d => d._children ? '#0d1117' : '#c9d1d9'); // Dark text if collapsed (filled), Light if expanded

        // Update Icons
        nodeUpdate.select('.icons-group')
            .attr('transform', d => `translate(${(nodeWidth/2) - 25}, ${(-getNodeHeight(d)/2) + 10})`);
        
        nodeUpdate.selectAll('.node-icon')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .style('fill', d => d._children ? '#0d1117' : '#8b949e'); // Adjust icon color based on background

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

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // --- 7. INTERACTION HANDLERS ---
    function clickNode(event, d) {
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

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    function openModal(title, description) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = description;
        modal.style.display = "block";
    }

    closeModalBtn.onclick = function() { modal.style.display = "none"; }
    window.onclick = function(event) { if (event.target == modal) modal.style.display = "none"; }

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
