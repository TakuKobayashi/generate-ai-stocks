import UIKit

class KeyboardViewController: UIInputViewController {
    private var clipboardCV: UICollectionView!
    private var isClipboardVisible = false
    private var clipboardItems: [ClipboardItem] = []
    private let defaults = UserDefaults(suiteName: "group.com.example.clipboardmanager")
    private var caps = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(white: 0.88, alpha: 1.0)
        setupUI()
        loadClipboardData()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        loadClipboardData()
    }

    // MARK: - UI Setup
    private func setupUI() {
        let root = UIStackView()
        root.axis = .vertical; root.spacing = 0
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)
        NSLayoutConstraint.activate([
            root.topAnchor.constraint(equalTo: view.topAnchor),
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            root.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // Toolbar
        let toolbar = makeToolbar()
        root.addArrangedSubview(toolbar)

        // Clipboard history
        clipboardCV = makeClipboardCollectionView()
        clipboardCV.isHidden = true
        root.addArrangedSubview(clipboardCV)

        // Keyboard rows
        let keyStack = makeKeyboardStack()
        root.addArrangedSubview(keyStack)
    }

    private func makeToolbar() -> UIView {
        let bar = UIView()
        bar.backgroundColor = UIColor(white: 0.82, alpha: 1.0)
        bar.heightAnchor.constraint(equalToConstant: 40).isActive = true

        let clipBtn = UIButton(type: .system)
        clipBtn.setTitle("📋 履歴", for: .normal)
        clipBtn.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        clipBtn.backgroundColor = .white
        clipBtn.layer.cornerRadius = 6
        clipBtn.addTarget(self, action: #selector(toggleClipboard), for: .touchUpInside)
        clipBtn.translatesAutoresizingMaskIntoConstraints = false
        bar.addSubview(clipBtn)

        let nextBtn = UIButton(type: .system)
        nextBtn.setTitle("🌐", for: .normal)
        nextBtn.titleLabel?.font = .systemFont(ofSize: 18)
        nextBtn.addTarget(self, action: #selector(advanceToNextInputMode), for: .touchUpInside)
        nextBtn.translatesAutoresizingMaskIntoConstraints = false
        bar.addSubview(nextBtn)

        NSLayoutConstraint.activate([
            clipBtn.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
            clipBtn.trailingAnchor.constraint(equalTo: bar.trailingAnchor, constant: -8),
            clipBtn.widthAnchor.constraint(equalToConstant: 90),
            clipBtn.heightAnchor.constraint(equalToConstant: 30),
            nextBtn.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
            nextBtn.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 8)
        ])
        return bar
    }

    private func makeClipboardCollectionView() -> UICollectionView {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.itemSize = CGSize(width: 130, height: 64)
        layout.minimumInteritemSpacing = 8
        layout.sectionInset = UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        let cv = UICollectionView(frame: .zero, collectionViewLayout: layout)
        cv.backgroundColor = .white
        cv.heightAnchor.constraint(equalToConstant: 80).isActive = true
        cv.delegate = self
        cv.dataSource = self
        cv.register(ClipboardCell.self, forCellWithReuseIdentifier: "cell")
        return cv
    }

    private func makeKeyboardStack() -> UIStackView {
        let rows: [[String]] = [
            ["q","w","e","r","t","y","u","i","o","p"],
            ["a","s","d","f","g","h","j","k","l"],
            ["⇧","z","x","c","v","b","n","m","⌫"]
        ]
        let stack = UIStackView()
        stack.axis = .vertical; stack.spacing = 6
        stack.layoutMargins = UIEdgeInsets(top: 8, left: 4, bottom: 8, right: 4)
        stack.isLayoutMarginsRelativeArrangement = true

        for row in rows { stack.addArrangedSubview(makeRow(keys: row)) }
        stack.addArrangedSubview(makeBottomRow())
        return stack
    }

    private func makeRow(keys: [String]) -> UIStackView {
        let row = UIStackView()
        row.axis = .horizontal; row.spacing = 5; row.distribution = .fillEqually
        for key in keys { row.addArrangedSubview(makeKey(key)) }
        return row
    }

    private func makeBottomRow() -> UIStackView {
        let row = UIStackView(); row.axis = .horizontal; row.spacing = 5
        let comma = makeKey(","); comma.widthAnchor.constraint(equalToConstant: 44).isActive = true
        let space = makeKey("スペース")
        let period = makeKey("."); period.widthAnchor.constraint(equalToConstant: 44).isActive = true
        let ret = makeKey("改行"); ret.widthAnchor.constraint(equalToConstant: 80).isActive = true
        row.addArrangedSubview(comma); row.addArrangedSubview(space)
        row.addArrangedSubview(period); row.addArrangedSubview(ret)
        return row
    }

    private func makeKey(_ label: String) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(label, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: label.count > 2 ? 13 : 18)
        btn.setTitleColor(.black, for: .normal)
        btn.backgroundColor = .white
        btn.layer.cornerRadius = 5
        btn.layer.shadowColor = UIColor.black.cgColor
        btn.layer.shadowOffset = CGSize(width: 0, height: 1)
        btn.layer.shadowOpacity = 0.25
        btn.layer.shadowRadius = 0
        btn.heightAnchor.constraint(equalToConstant: 42).isActive = true
        btn.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        return btn
    }

    // MARK: - Actions
    @objc private func toggleClipboard() {
        isClipboardVisible.toggle()
        clipboardCV.isHidden = !isClipboardVisible
        if isClipboardVisible { loadClipboardData(); clipboardCV.reloadData() }
    }

    @objc private func keyTapped(_ sender: UIButton) {
        guard let label = sender.currentTitle else { return }
        let proxy = textDocumentProxy
        switch label {
        case "⌫": proxy.deleteBackward()
        case "⇧":
            caps.toggle()
            updateCapsState()
        case "スペース": proxy.insertText(" ")
        case "改行": proxy.insertText("\n")
        default: proxy.insertText(caps ? label.uppercased() : label)
        }
    }

    private func updateCapsState() {
        // シフト状態をビジュアルに反映する場合はここで対応
    }

    private func loadClipboardData() {
        guard let data = defaults?.data(forKey: "frequently_used_items"),
              let items = try? JSONDecoder().decode([ClipboardItem].self, from: data)
        else { return }
        clipboardItems = items
    }
}

// MARK: - UICollectionView
extension KeyboardViewController: UICollectionViewDataSource, UICollectionViewDelegate {
    func collectionView(_ cv: UICollectionView, numberOfItemsInSection section: Int) -> Int { clipboardItems.count }
    func collectionView(_ cv: UICollectionView, cellForItemAt ip: IndexPath) -> UICollectionViewCell {
        let cell = cv.dequeueReusableCell(withReuseIdentifier: "cell", for: ip) as! ClipboardCell
        cell.configure(with: clipboardItems[ip.item]); return cell
    }
    func collectionView(_ cv: UICollectionView, didSelectItemAt ip: IndexPath) {
        let item = clipboardItems[ip.item]
        textDocumentProxy.insertText(item.content)
        // 使用回数を更新
        var updated = item; updated = ClipboardItem(id: item.id, content: item.content,
            createdAt: item.createdAt, lastUsedAt: Date(), usageCount: item.usageCount + 1)
        if var all = defaults?.data(forKey: "clipboard_items"),
           var items = try? JSONDecoder().decode([ClipboardItem].self, from: all) {
            if let idx = items.firstIndex(where: { $0.id == item.id }) {
                items[idx] = updated
                if let encoded = try? JSONEncoder().encode(items) {
                    defaults?.set(encoded, forKey: "clipboard_items")
                }
            }
        }
    }
}

// MARK: - ClipboardCell
class ClipboardCell: UICollectionViewCell {
    private let label = UILabel()
    private let countLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.backgroundColor = UIColor(white: 0.96, alpha: 1)
        contentView.layer.cornerRadius = 8
        label.numberOfLines = 2; label.font = .systemFont(ofSize: 11)
        label.translatesAutoresizingMaskIntoConstraints = false
        countLabel.font = .boldSystemFont(ofSize: 10); countLabel.textColor = .systemBlue
        countLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label); contentView.addSubview(countLabel)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 6),
            label.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -6),
            countLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
            countLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -6)
        ])
    }
    required init?(coder: NSCoder) { fatalError() }

    func configure(with item: ClipboardItem) {
        label.text = item.previewText(maxLength: 35)
        countLabel.text = "\(item.usageCount)x"
    }
}
