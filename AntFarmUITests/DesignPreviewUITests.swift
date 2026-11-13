import XCTest

final class DesignPreviewUITests: XCTestCase {
    func testSelectionAndScopeAreAccessible() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["selectedAntID"].waitForExistence(timeout: 15))
        XCTAssertEqual(app.staticTexts["selectedAntID"].label, "C-027")
        app.buttons["inspectAnts"].tap()
        let queen = app.buttons["antRow_Q-001"]
        XCTAssertTrue(queen.waitForExistence(timeout: 5))
        queen.tap()
        XCTAssertEqual(app.staticTexts["selectedAntID"].label, "Q-001")
        app.buttons["focusAnt"].tap()
        app.buttons["toggleTrails"].tap()
        XCTAssertEqual(app.buttons["toggleTrails"].value as? String, "On")
        app.buttons["previewInfo"].tap()
        XCTAssertTrue(app.navigationBars["Design preview"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Landscape inspection"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
